const core = require('griboyedov');
const Moments = core.Moments;
const Abstract = require('./Abstract');
const Event = require('../../model/Event');

class Message extends Abstract {
    static async handle(data, blockNum) {
        // TODO wait blockchain implementation
        // TODO filtrate from transactions
    }
}

module.exports = Message;
