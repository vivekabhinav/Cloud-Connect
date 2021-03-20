"use strict";

const express = require("express");
const environmentVars = require("dotenv").config();

const speech = require("@google-cloud/speech");
const speechClient = new speech.SpeechClient();

const { Translate } = require("@google-cloud/translate").v2;

// Creates a client
const translate = new Translate();

/**
 * TODO(developer): Uncomment the following lines before running the sample.
 */
const text = "The text to translate, e.g. Hello, world!";
const target = "ru";

const app = express();
const port = process.env.PORT || 1337;
const server = require("http").createServer(app);
let languageCode = "en";
const io = require("socket.io")(server);
app.use("/assets", express.static(__dirname + "/public"));
app.use("/session/assets", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

app.get("/", function (req, res) {
  res.render("index", {});
});

app.use("/", function (req, res, next) {
  next();
});

io.on("connection", function (client) {
  console.log("Client Connected to server");
  let recognizeStream = null;

  client.on("join", function () {
    client.emit("messages", "Socket Connected to Server");
  });

  client.on("messages", function (data) {
    client.emit("broad", data);
  });

  client.on("socketdeneme", (msg) => {
    console.log(msg);
    request.config.languageCode = msg;
  });

  client.on("textlanguage", (data) => {
    console.log("language " + data);
    tr.target = data;
  });

  client.on("texttoconvert", (data) => {
    console.log("text " + data);
    tr.text = data;
    async function translateText() {
      // Translates the text into the target language. "text" can be a string for
      // translating a single piece of text, or an array of strings for translating
      // multiple texts.
      let [translations] = await translate.translate(tr.text, tr.target);
      translations = Array.isArray(translations)
        ? translations
        : [translations];
      console.log("Translations:");
      // translations.forEach((translation, i) => {
      //   console.log(`${text[i]} => (${target}) ${translation}`);
      // });
      let str = "";
      translations.map((translate) => {
        str += translate;
      });
      console.log(str);
      client.emit("transdata", str);
    }

    translateText();
  });

  client.on("startGoogleCloudStream", function (data) {
    startRecognitionStream(this, data);
  });

  client.on("endGoogleCloudStream", function () {
    stopRecognitionStream();
  });

  client.on("binaryData", function (data) {
    if (recognizeStream !== null) {
      recognizeStream.write(data);
    }
  });

  function startRecognitionStream(client) {
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on("error", console.error)
      .on("data", (data) => {
        process.stdout.write(
          data.results[0] && data.results[0].alternatives[0]
            ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
            : "\n\nReached transcription time limit, press Ctrl+C\n"
        );

        client.emit("speechData", data);

        if (data.results[0] && data.results[0].isFinal) {
          stopRecognitionStream();
          startRecognitionStream(client);
        }
      });
  }

  function stopRecognitionStream() {
    if (recognizeStream) {
      recognizeStream.end();
    }
    recognizeStream = null;
  }
});

const encoding = "LINEAR16";
const sampleRateHertz = 16000;

const tr = {
  text: text,
  target: target,
};

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    profanityFilter: false,
    enableWordTimeOffsets: true,
    alternativeLanguageCodes: ["fr", "ru", "de", "hi"],
  },
  interimResults: true,
};

server.listen(port, "127.0.0.1", function () {
  console.log("Server started on port:" + port);
});
