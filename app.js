// Author: Nico Schröder
// 07.10.2022

const {resolve} = require('path');
process.env.NODE_CONFIG_DIR = 'Whatever/your/path/is/config'; // -> Must be set in order for scheduled task to work
const config = require("config");
const path = config.get('path');
var HTMLParser = require("node-html-parser");
var JSSoup = require("jssoup").default;
const superagent = require("superagent").agent();
const jsonfile = require("jsonfile");
const { symlinkSync } = require('fs');
const file = path + "/known_exams.json";

//Init
const user = config.get("user");
const password = config.get("password"); // TODO: Password decodieren wegen Sonderzeichen
var asi = null;
var exams = 0;
var new_grades = 0;

// read known exams from known_exams.json
var exam_nrs;
jsonfile.readFile(file, function (err, obj) {
    if (err) {
        console.error(err);
    } else {
        exam_nrs = obj;
    }
});

const hsf = async () => {
    console.log("logging in...");
    let login = await superagent
        .post(
            "https://horstl.hs-fulda.de/qisserver/rds?state=user&type=1&category=auth.login"
        )
        .send({ asdf: user, fdsa: password })
        .set("Content-Type", "application/x-www-form-urlencoded");
    console.log(user + " succesfully logged in");

    // get asi
    console.log("getting asi...");
    let resultContainingAsi = await superagent.get(
        "https://horstl.hs-fulda.de/qisserver/rds?state=redirect&sso=qisstu&myre=state%253Duser%2526type%253D0%2526htmlBodyOnly%253Dtrue%2526topitem%253Dfunctions%2526language%253Dde"
    );
    let tag_a = new JSSoup(resultContainingAsi.text, false).findAll("a");
    var i = 0;
    while (tag_a[i]) {
        let str = tag_a[i++].attrs.href;
        if (!isValidUrl(str)) {
            continue;
        }
        asi = new URL(str).searchParams.get("amp;asi");
        if (asi) break;
    }
    if (!asi) {
        console.log("asi could not be extracted");
        // Exit...
    }
    console.log("asi succesfully extracted: " + asi);

    // get transcript_of_records
    console.log("getting transcript of records...");
    let transcript_of_records_link = await superagent.get(
        "https://qispos.hs-fulda.de/qisserver/rds?state=notenspiegelStudent&next=tree.vm&nextdir=qispos/notenspiegel/student&navigationPosition=functions%2CnotenspiegelStudent&breadcrumb=notenspiegel&topitem=functions&subitem=notenspiegelStudent&asi=" +
            asi
    );
    console.log("transcript of records received\nnow parsing to get data...");
    tag_a = new JSSoup(transcript_of_records_link.text, false).findAll("a");
    i = 0;
    while (tag_a[i]) {
        let str = tag_a[i++].attrs.href;
        if (!isValidUrl(str)) {
            continue;
        }
        if (new URL(str).searchParams.get("amp;struct") == "auswahlBaum") {
            let grades = await superagent.get(
                new URL(str).href.replaceAll("&amp;", "&")
            );
            let transcript_of_records_tr = HTMLParser.parse(grades.text)
                .querySelectorAll("table")[1]
                .querySelectorAll("tr");
            j = 0;
            while (transcript_of_records_tr[j]) {
                if (transcript_of_records_tr[j].querySelector("th")) {
                    j++;
                    continue;
                }
                let data = transcript_of_records_tr[j++].querySelectorAll("td");
                let obj = {
                    exam_nr: "",
                    title: "",
                    grade: "",
                    credits: "",
                    try: "",
                    date_of_exam: "",
                };
                let k = 0;
                while (data[k]) {
                    let str = data[k].text
                        .replaceAll("\\t", "")
                        .replaceAll("\\r", "")
                        .replaceAll("\\n", "")
                        .trim();
                    switch (k) {
                        case 0:
                            obj.exam_nr = str;
                        case 1:
                            obj.title = str;
                        case 2:
                            obj.grade = str;
                        case 4:
                            obj.credits = str;
                        case 5:
                            obj.try = str;
                        case 6:
                            obj.date_of_exam = str;
                    }
                    k++;
                }
                if (!is_relevant_exam_nr(obj.exam_nr)) {
                    continue;
                }

                exams++;

                // check if exam_nr already exists...
                if (!exam_nrs.known_exam_nr.includes(obj.exam_nr)) {
                    console.log(
                        "NOTIFICATION! -> New grade for exam discovered..."
                    );
                    console.log(obj);
                    console.log("writing new entry... exam_nr: " + obj.exam_nr);
                    new_grades++;
                    exam_nrs.known_exam_nr.push(obj.exam_nr);
                    jsonfile.writeFile(file, exam_nrs, function (err) {
                        if (err) console.error(err);
                    });
                }
            }
            break;
        }
    }
    console.log("script terminates");
    console.log("exams checked: " + exams);
    console.log("new grades: " + new_grades);
};

const isValidUrl = (urlString) => {
    try {
        return Boolean(new URL(urlString));
    } catch (e) {
        return false;
    }
};

const is_relevant_exam_nr = (exam_nr) => {
    try {
        return exam_nr != "100" && exam_nr != "500" && exam_nr != "900";
    } catch (e) {
        return false;
    }
};

hsf();
