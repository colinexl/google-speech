// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');
const async = require('async');
const fs = require('fs');
const flacFiles = require('./flac.json');

// Creates a client
const client = new speech.SpeechClient();

const maxInProgress = 5;

function callSpeech(flacName, callback) {
  // The name of the audio file to transcribe
  const uri = `gs://ctninvestments/flacs/${flacName}.flac`;

  // The audio file's encoding, sample rate in hertz, and BCP-47 language code
  const audio = {
    // content: audioBytes,
    uri: uri
  };
  const config = {
    encoding: 'FLAC',
    sampleRateHertz: 44100,
    languageCode: 'en-US'
  };
  const request = {
    audio: audio,
    config: config
  };

  // console.log('request', request);
  console.log(`processing: ${flacName}`);

  // Handle the operation using the event emitter pattern.
  client
    .longRunningRecognize(request)
    .then(responses => {
      var operation = responses[0];
      var initialApiResponse = responses[1];
      console.log('initialApiResponse', initialApiResponse);

      // Adding a listener for the "complete" event starts polling for the completion
      // of the operation.
      operation.on('complete', (result, metadata, finalApiResponse) => {
        // doSomethingWith(result);
        // console.log(result);
        const transcription = result
          .results
          .map(result => result.alternatives[0].transcript)
          .join(' ');
        console.log(`Transcription ${flacName}: ${transcription}`);
        fs.writeFileSync(`./flacs/${flacName}.txt`, transcription);

        return callback();
      });

      // Adding a listener for the "progress" event causes the callback to be called
      // on any change in metadata when the operation is polled.
      operation.on('progress', (metadata, apiResponse) => {
        // doSomethingWith(metadata)
        console.log(`progress ${flacName}: ${metadata.progressPercent}%`);
      });

      // Adding a listener for the "error" event handles any errors found during
      // polling.
      operation.on('error', err => {
        // throw(err);
        console.error(err);
        return callback(new Error(err));
      });
    })
    .catch(err => {
      console.error(err);
    });
}

// The queue sends the image ID to callSpeech() and writes the response to a local file
// once the entire queue has finished processing
let q = async.queue(callSpeech, maxInProgress);

q.push(flacFiles, function (err) {
  if (err) {
    console.log(err)
  }
});

function done() {
  q.drain = null;
  console.log('All work complete');
  // fs.writeFileSync('./responses.json', JSON.stringify(imageData));
}

// Will only be executed when the queue is drained
q.drain = done;
