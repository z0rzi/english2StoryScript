const {PythonShell} = require('python-shell');
const fs = require('fs');

const SPLITTERS_PATH = './assets/splitters.json';
const EXPRESSIONS_PATH = './assets/expressions.json';
const PYPARSER_PATH = './src/sentenceProcessing/tokenizer.py';

/**
 * Represents a word, just there for clarity
 */
class Word {
    constructor(word0, type0) {
        this._word = word0;
        this._type = type0;
    }

    isVerb()        { return  /^VBP?$/.test(this._type); }
    isNoun()        { return  /^NN[^P]?$/.test(this._type); }
    isPronoun()     { return /^PRP/.test(this._type); }
    isPunctuation() { return /[.,]/.test(this._type); }
}

/**
 * This represents an instruction.
 * e.g. "turn on the lights", or "If It's cold outside"
 */
class SubSentence {
    constructor(str, tokens) {
        if (!str || !tokens || !tokens.length) {
            return;
        }
        this._str = str;
        this._words = tokens;

        // cleaning out the sentence: taking of punctuation and white space at
        // end and beggining of sentence
        this._str = this._str
            .replace(/^[^\w]+/, '')
            .replace(/[^\w]+$/, '');

        while (this._words[0].isPunctuation()) {
            this._words.shift();
        }
        while (this._words[this._words.length-1].isPunctuation()) {
            delete this._words.pop();
        }
    }


    beginsWithAVerb() {
        return this._words[0].isVerb();
    }

    isEmpty() {
        return !this._str || /^[^\w]+$/.test(this._str);
    }

    normalize() {
        this._str = this._str
            .toLowerCase()
            .replace(/[\s+]/, ' ')
            .replace(/['"[\]{}()]/, '')
            .replace(/^[^\w]+/, '')
            .replace(/[^\w]+$/, '');
    }
}

class Sentence {

    constructor(sentence0) {
        this._sentence = sentence0;
        this.replaceExpressions();
    }

    /**
     * Replaces expressions as defined in the expression json file
     */
    replaceExpressions() {

        var expressions = JSON.parse(fs.readFileSync(EXPRESSIONS_PATH, 'utf8'));

        for( const key of Object.keys(expressions) ) {
            this._sentence = this._sentence.replace(new RegExp(key, 'gi'), expressions[key]);
        }

        return this._sentence;
    }

    /**
     * Transforms the sentence into a list of words.
     */
    tokenize() {

        if( this._words ) {
            return new Promise((y)=>y(this._words));
        }

        let options = {
            mode: 'text',
            pythonPath: '/usr/bin/python3',
            pythonOptions: ['-u'], // get print results in real-time
            args: this._sentence.split(/\s+/)
        };

        return new Promise((success, failure) => {
            PythonShell.run(PYPARSER_PATH, options, (err, results) => {
                if (err) failure(err);
                this._words = JSON.parse(results[0]).map(tok => new Word(tok[0], tok[1]));
                success(this._words);
            });
        });
    }

    /**
     * Splits the sentence to keep simple orders
     * e.g. "Turn on the heater when the temperature is below 15"
     *         V    V    V    V    V    V    V    V    V    V
     *      "Turn on the heater", "when the temperature is below 15"
     *
     * Rules are as follow:
     *  - A punctuation mark is a splitter
     *  - A verb preceded by anything other than a pronoun is a splitter
     *  - Any word contained in the splitters dictionnary is a splitter
     */
    async split() {
        // Making sure we have the tokens
        await this.tokenize();

        var splitters = JSON.parse(fs.readFileSync(SPLITTERS_PATH, 'utf8'));
        let endOfLastSub = 0;
        let str = '';

        let out = [];

        this._words.forEach((word, idx) => {
            if (
                splitters.some(s => s.toLowerCase() === word._word.toLowerCase()) || 
                word.isPunctuation()
            ) {
                let subStr = str;
                let tokens = this._words.slice(endOfLastSub, idx);
                out.push(new SubSentence(subStr, tokens));
                endOfLastSub = idx;

                str = '';
            }

            str += ' ' + word._word;
        });

        let subStr = str;
        let tokens = this._words.slice(endOfLastSub);
        out.push(new SubSentence(subStr, tokens));

        out = out.filter(sub => !sub.isEmpty());
        out.forEach(sub => sub.normalize());

        return out;
    }
}

module.exports = {};
module.exports.Sentence = Sentence;
