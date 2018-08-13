const core = require('gls-core-service');
const Moments = core.Moments;
const Abstract = require('./Abstract');
const Event = require('../../model/Event');

class Reply extends Abstract {
    static async handle(
        { parent_author: user, parent_permlink: parentPermlink, author, permlink },
        blockNum
    ) {
        if (!user) {
            return;
        }

        this.emit('reply', user, { author, permlink });

        let model = model = new Event({
            blockNum,
            user,
            eventType: 'reply',
            permlink,
            parentPermlink,
            fromUsers: [author],
        });

        await model.save();
    }
}

module.exports = Reply;
