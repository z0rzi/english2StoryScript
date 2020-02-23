
const {Sentence} = require('./sentenceProcessing/processor');
const {Story} = require('./storyMaker.js');
const readline = require('readline');


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


function waitForNewInput() {
    rl.question('Enter a sentence: ', (str) => {

        let sent = new Sentence(str);

        let story = new Story(sent);

        story.buildStory().then(story => {
            console.log(story);
            waitForNewInput();
        });
    });
}

waitForNewInput();
