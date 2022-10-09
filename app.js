// Author: Nico Schröder
// 07.10.2022

const { EmbedBuilder, WebhookClient } = require("discord.js");

// !!!
// You need to set the following 2 variables (path where this file is located & url of your webhook):
const path = "Whatever/your/path/is";
const webhookClient = new WebhookClient({
    url: ""
});
// !!!

if (path == "Whatever/your/path/is" || path == "") {
    console.log("Please set the path variable.");
    return;
}
process.env.NODE_CONFIG_DIR = path + "/config";
const config = require("config");
var HTMLParser = require("node-html-parser");
var JSSoup = require("jssoup").default;
const superagent = require("superagent").agent();
const jsonfile = require("jsonfile");

// Init
const file = path + "\\known_exams.json";
const user = config.get("user");
const password = config.get("password");
if (!user || !password) {
    console.log("Password and/or username could not be extracted")
    console.log(
        "Please check if password and username (fd-Nr.) are set correctly in /config/default.json"
    );
    return;
}
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
    try {
        var login = await superagent
            .post(
                "https://horstl.hs-fulda.de/qisserver/rds?state=user&type=1&category=auth.login"
            )
            .send({ asdf: user, fdsa: password })
            .set("Content-Type", "application/x-www-form-urlencoded");
    } catch (error) {
        console.error(error);
        return;
    }
    // get asi
    try {
        var resultContainingAsi = await superagent.get(
            "https://horstl.hs-fulda.de/qisserver/rds?state=redirect&sso=qisstu&myre=state%253Duser%2526type%253D0%2526htmlBodyOnly%253Dtrue%2526topitem%253Dfunctions%2526language%253Dde"
        );
    } catch (error) {
        console.error(error);
        return;
    }
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
        console.error("asi could not be extracted");
        console.error(
            "Please check if password and/or username (fd-Nr.) are set correctly in /config/default.json"
        );
        return;
    }
    console.log(user + " succesfully logged in");
    console.log("asi succesfully extracted: " + asi);

    // get transcript_of_records
    console.log("getting transcript of records...");
    try {
        var transcript_of_records_link = await superagent.get(
            "https://qispos.hs-fulda.de/qisserver/rds?state=notenspiegelStudent&next=tree.vm&nextdir=qispos/notenspiegel/student&navigationPosition=functions%2CnotenspiegelStudent&breadcrumb=notenspiegel&topitem=functions&subitem=notenspiegelStudent&asi=" +
                asi
        );
        console.log("transcript of records received");
    } catch (error) {
        console.error(error);
        return;
    }
    console.log("now parsing to get data...");
    tag_a = new JSSoup(transcript_of_records_link.text, false).findAll("a");
    i = 0;
    while (tag_a[i]) {
        let str = tag_a[i++].attrs.href;
        if (!isValidUrl(str)) {
            continue;
        }
        if (new URL(str).searchParams.get("amp;struct") == "auswahlBaum") {
            try {
                var grades = await superagent.get(
                    new URL(str).href.replaceAll("&amp;", "&")
                );
            } catch (error) {
                console.error(error);
                return;
            }
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
                    // build message to send via discord
                    let message = obj.title + " (" + obj.exam_nr + ")";
                    if (obj.grade) {
                        message += "\nNote: " + obj.grade;
                    }

                    //send Discord Notification via a webhook
                    try {
                        webhookClient.send({
                            content: message,
                            username: "hs-fulda_exam_alert",
                        });
                    } catch (error) {
                        console.error(error);
                    }

                    console.log(obj);
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
