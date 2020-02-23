
const bayes = require('bayes');
const fs = require('fs');

const METHODS_PATHS  = 'assets/methods.json';
const SERVICES_PATHS = 'assets/services.json';
const COMMANDS_PATHS = 'assets/services/';

/**
 * Replresents one line of the story
 */
class StoryLine {
    constructor(sub_sentence) {
        this._sentence = sub_sentence;
        this._indentLevel = 0;
    }

    async findMethod() {
        if (this._method) return this._method;

        if (this._sentence.beginsWithAVerb()) {
            this._method = 'execute';
            return 'execute';
        }
        let methods = JSON.parse(fs.readFileSync(METHODS_PATHS, 'utf8'));

        var classifier = bayes();

        for (const method of Object.keys(methods)) {
            for (const synonym of methods[method]) {
                await classifier.learn(synonym.toLowerCase(), method);
            }
        }

        let method = await classifier.categorize(this._sentence._str);

        this._method = method;
        return method;
    }

    async findService() {
        if (this._service) return this._service;

        let services = JSON.parse(fs.readFileSync(SERVICES_PATHS, 'utf8'));

        var classifier = bayes();

        for (const service of Object.keys(services)) {
            // If the sentence contains the exact service name, then it's this service
            if (new RegExp(service).test(this._sentence._str)) {
                this._service = service;
                return service;
            }
            
            // Otherwise, we guess
            for (const synonym of services[service]) {
                await classifier.learn(synonym.toLowerCase(), service);
            }
        }

        let service = await classifier.categorize(this._sentence._str);

        this._service = service;

        return service;
    }

    async findCommand() {
        if (this._command) return this._command;

        await this.findService();

        let commands;
        let path = 
            COMMANDS_PATHS +
            this._service +
            '/' +
            (this._method === 'when' ? 'events':'actions') +
            '.json';
        
        try {
            commands = JSON.parse(fs.readFileSync(path, 'utf8'));
        } catch (e) {
            console.error('Error, file not found or unreadeable: ' + path);
            return;
        }

        var classifier = bayes();

        for (const command of Object.keys(commands)) {
            for (const synonym of commands[command]) {
                await classifier.learn(synonym.toLowerCase(), command);
            }
        }

        let command = await classifier.categorize(this._sentence._str);

        this._command = command;

        return command;
    }

    async findArguments() { 
    }

    setIndentLevel(il) {
        this._indentLevel = il;
    }

    /**
     * Returns the line in storyscript code
     */
    async script() {
        await this.findMethod();
        await this.findService();
        await this.findCommand();

        let out = [
            '    '.repeat(this._indentLevel)
        ];

        if (this._method !== 'execute') {
            out.push(this._method);
        }

        out = [...out,
            this._service,
            this._command
        ];

        if (this._method === 'when') {
            out = [...out,
                'as', 'varName'
            ];
        }

        return out.join(' ');
    }
}

class Story {
    constructor(sentence0) {
        this._sentence = sentence0;
    }

    /**
     * Returns the StoryScript Story
     */
    async buildStory() {
        let subStrings = await this._sentence.split();
        this._lines = [];
        for (let sub of subStrings) {
            let sl = new StoryLine(sub);

            await sl.findMethod();
            await sl.findCommand();

            this._lines.push(sl);
        }

        // If there's a condition, put it as the top line, and indent all other lines
        for (let i=0 ; i<this._lines.length ; i++) {
            if (this._lines[i]._method !== 'execute') {
                let [l] = this._lines.splice(i, 1);
                this._lines.forEach(line => line.setIndentLevel(1));
                this._lines.unshift(l);
            }
        }

        let story = '';

        for (const line of this._lines) {
            story += await line.script();
            story += '\n';
        }

        return story;
    }
}


module.exports = {};
module.exports.StoryLine = StoryLine;
module.exports.Story = Story;
