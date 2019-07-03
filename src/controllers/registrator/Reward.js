const Abstract = require('./Abstract');
const Event = require('../../models/Event');

class Reward extends Abstract {
    async handleEvent(
        { to: target, from, quantity, memo },
        { blockNum, transactionId, app, receiver }
    ) {
        if (await this._isUnnecessary({ from, receiver, target, app })) {
            return;
        }

        await this.waitForTransaction(transactionId);

        const { amount, currency } = this._parseQuantity(quantity);
        const { contentId, user, type } = this._parseMemo(memo);
        const { comment, post } = await this._getMeta(contentId, app);

        const model = new Event({
            blockNum,
            user,
            post,
            comment,
            eventType: type,
            fromUsers: [from],
            value: {
                amount,
                currency,
            },
            app,
        });

        await model.save();

        this.emit('registerEvent', user, model.toObject());
    }

    _parseMemo(memo) {
        const pattern = /send to: (?<user>.*); *(?<rawType>[\S]*).*(post|comment) (?<author>.*):(?<permlink>.*)/;
        const { author, rawType, userId, permlink } = memo.match(pattern).groups;
        let type;

        switch (rawType) {
            case 'author':
                type = 'reward';
                break;

            case 'curators':
                type = 'curatorReward';
                break;

            case 'benefeciary':
                type = 'benefeciaryReward';
                break;
        }

        return {
            type,
            author,
            contentId: { userId, permlink },
        };
    }

    _parseQuantity(quantity) {
        const [amount, currency] = quantity.split(' ');

        return { amount, currency };
    }

    async _isUnnecessary({ from, target, receiver, app }) {
        const isPublishContract = from.endsWith('.publish');
        const isVestingIsReceiver = receiver.endsWith('.vesting');
        const isVestingIsTarget = target.endsWith('.vesting');

        if (!(isPublishContract && isVestingIsReceiver && isVestingIsTarget)) {
            return true;
        }

        return await this._isInBlackList(from, target, app);
    }

    async _getMeta(contentId, app) {
        const meta = await this.getEntityMetaData({ contentId }, app);

        return {
            comment: meta.comment,
            post: meta.post || meta.comment.parentPost,
        };
    }
}

module.exports = Reward;
