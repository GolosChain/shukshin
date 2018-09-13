const Abstract = require('./Abstract');
const Event = require('../../models/Event');

class Vote extends Abstract {
    static async handle({ voter, author: user, permlink, weight }, blockNum) {
        if (weight === 0) {
            return;
        }

        if (voter === user) {
            return;
        }

        let type;

        if (weight > 0) {
            type = 'vote';
        } else {
            type = 'flag';
        }

        this.emit(type, user, { voter, permlink });

        const model = new Event({
            blockNum,
            user,
            eventType: type,
            permlink: permlink,
            fromUsers: [voter],
        });
        await model.save();
    }
}

module.exports = Vote;