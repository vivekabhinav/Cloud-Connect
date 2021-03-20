"use strict";

const socket = io.connect();

let bufferSize = 2048,
  AudioContext,
  context,
  processor,
  input,
  globalStream;

let audioElement = document.querySelector("audio"),
  finalWord = false,
  resultText = document.getElementById("ResultText"),
  removeLastSentence = true,
  streamStreaming = false;

const constraints = {
  audio: true,
  video: false,
};

function initRecording() {
  socket.emit("startGoogleCloudStream", "");
  streamStreaming = true;
  AudioContext = window.AudioContext || window.webkitAudioContext;
  context = new AudioContext({
    latencyHint: "interactive",
  });
  processor = context.createScriptProcessor(bufferSize, 1, 1);
  processor.connect(context.destination);
  context.resume();

  var handleSuccess = function (stream) {
    globalStream = stream;
    input = context.createMediaStreamSource(stream);
    input.connect(processor);

    processor.onaudioprocess = function (e) {
      microphoneProcess(e);
    };
  };

  navigator.mediaDevices.getUserMedia(constraints).then(handleSuccess);
}

function microphoneProcess(e) {
  var left = e.inputBuffer.getChannelData(0);
  var left16 = downsampleBuffer(left, 44100, 16000);
  socket.emit("binaryData", left16);
}

var startButton = document.getElementById("startRecButton");
startButton.addEventListener("click", startRecording);

var endButton = document.getElementById("stopRecButton");
endButton.addEventListener("click", stopRecording);
endButton.disabled = true;

var recordingStatus = document.getElementById("recordingStatus");

function startRecording() {
  startButton.disabled = true;
  endButton.disabled = false;
  recordingStatus.style.visibility = "visible";
  initRecording();
}
function sendInfo() {
  var x = document.getElementById("m").value;
  console.log(x);
  socket.emit("socketdeneme", x);
}
function sendTranslation() {
  let code = document.getElementById("m1").value;
  let text = document.getElementById("ResultText").innerText;
  console.log("abc", code);
  socket.emit("textlanguage", code);
  socket.emit("texttoconvert", text);
}
function stopRecording() {
  startButton.disabled = false;
  endButton.disabled = true;
  recordingStatus.style.visibility = "hidden";
  streamStreaming = false;
  socket.emit("endGoogleCloudStream", "");

  let track = globalStream.getTracks()[0];
  track.stop();

  input.disconnect(processor);
  processor.disconnect(context.destination);
  context.close().then(function () {
    input = null;
    processor = null;
    context = null;
    AudioContext = null;
    startButton.disabled = false;
  });
}

function textToAudio() {
  let msg = document.getElementById("translation").innerText;

  let speech = new SpeechSynthesisUtterance();
  speech.lang = document.getElementById("m1").value;

  speech.text = msg;
  speech.volume = 1;
  speech.rate = 1;
  speech.pitch = 1;

  window.speechSynthesis.speak(speech);
}

socket.on("connect", function (data) {
  console.log("connected to socket");
  socket.emit("join", "Server Connected to Client");
});

// document.querySelector("form").change(function () {
//   socket.emit("socketdeneme", document.querySelector("#m").value);
// });
socket.on("messages", function (data) {
  console.log(data);
});

socket.on("speechData", function (data) {
  var dataFinal = undefined || data.results[0].isFinal;

  if (dataFinal === false) {
    if (removeLastSentence) {
      resultText.lastElementChild.remove();
    }
    removeLastSentence = true;

    let empty = document.createElement("span");
    resultText.appendChild(empty);

    let edit = addTimeSettingsInterim(data);

    for (var i = 0; i < edit.length; i++) {
      resultText.lastElementChild.appendChild(edit[i]);
      resultText.lastElementChild.appendChild(
        document.createTextNode("\u00A0")
      );
    }
  } else if (dataFinal === true) {
    resultText.lastElementChild.remove();

    let empty = document.createElement("span");
    resultText.appendChild(empty);

    let edit = addTimeSettingsFinal(data);
    for (var i = 0; i < edit.length; i++) {
      if (i === 0) {
        edit[i].innerText = capitalize(edit[i].innerText);
      }
      resultText.lastElementChild.appendChild(edit[i]);

      if (i !== edit.length - 1) {
        resultText.lastElementChild.appendChild(
          document.createTextNode("\u00A0")
        );
      }
    }
    resultText.lastElementChild.appendChild(
      document.createTextNode("\u002E\u00A0")
    );

    console.log("Google Speech sent 'final' Sentence.");
    finalWord = true;
    endButton.disabled = false;

    removeLastSentence = false;
  }
});

socket.on("transdata", (data) => {
  console.log("blah" + data);
  document.getElementById("translation").innerText = data;
});

function addTimeSettingsInterim(speechData) {
  let wholeString = speechData.results[0].alternatives[0].transcript;
  console.log(wholeString);

  let nlpObject = nlp(wholeString).out("terms");

  let words_without_time = [];

  for (let i = 0; i < nlpObject.length; i++) {
    let word = nlpObject[i].text;
    let tags = [];

    let newSpan = document.createElement("span");
    newSpan.innerHTML = word;

    for (let j = 0; j < nlpObject[i].tags.length; j++) {
      tags.push(nlpObject[i].tags[j]);
    }

    for (let j = 0; j < nlpObject[i].tags.length; j++) {
      let cleanClassName = tags[j];

      let className = `nl-${cleanClassName}`;
      newSpan.classList.add(className);
    }

    words_without_time.push(newSpan);
  }

  finalWord = false;
  endButton.disabled = true;

  return words_without_time;
}

function addTimeSettingsFinal(speechData) {
  let wholeString = speechData.results[0].alternatives[0].transcript;

  let nlpObject = nlp(wholeString).out("terms");
  let words = speechData.results[0].alternatives[0].words;

  let words_n_time = [];

  for (let i = 0; i < words.length; i++) {
    let word = words[i].word;
    let startTime = `${words[i].startTime.seconds}.${words[i].startTime.nanos}`;
    let endTime = `${words[i].endTime.seconds}.${words[i].endTime.nanos}`;
    let tags = [];

    let newSpan = document.createElement("span");
    newSpan.innerHTML = word;
    newSpan.dataset.startTime = startTime;

    for (let j = 0; j < nlpObject[i].tags.length; j++) {
      tags.push(nlpObject[i].tags[j]);
    }

    for (let j = 0; j < nlpObject[i].tags.length; j++) {
      let cleanClassName = nlpObject[i].tags[j];

      let className = `nl-${cleanClassName}`;
      newSpan.classList.add(className);
    }

    words_n_time.push(newSpan);
  }

  return words_n_time;
}

window.onbeforeunload = function () {
  if (streamStreaming) {
    socket.emit("endGoogleCloudStream", "");
  }
};

function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  let buf = new Int16Array(l / 3);

  while (l--) {
    if (l % 3 == 0) {
      buf[l / 3] = buffer[l] * 0xffff;
    }
  }
  return buf.buffer;
}

var downsampleBuffer = function (buffer, sampleRate, outSampleRate) {
  if (outSampleRate == sampleRate) {
    return buffer;
  }
  if (outSampleRate > sampleRate) {
    throw "downsampling rate show be smaller than original sample rate";
  }
  var sampleRateRatio = sampleRate / outSampleRate;
  var newLength = Math.round(buffer.length / sampleRateRatio);
  var result = new Int16Array(newLength);
  var offsetResult = 0;
  var offsetBuffer = 0;
  while (offsetResult < result.length) {
    var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    var accum = 0,
      count = 0;
    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = Math.min(1, accum / count) * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result.buffer;
};

function capitalize(s) {
  if (s.length < 1) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
