const Abstract = require('./Abstract');
const Event = require('../../models/Event');

class Mention extends Abstract {
    async handle(
        {
            author,
            title,
            body,
            permlink,
            parent_permlink: parentPermlink,
            parent_author: parentAuthor,
            refBlockNum,
            parentPost,
            contractName,
        },
        blockNum,
        transactionId
    ) {
        await this.waitForTransaction(transactionId);
        const users = this._extractMention(title, body);

        for (let user of users) {
            user = await this.resolveName(user);

            if (user === author || user === parentAuthor) {
                continue;
            }

            if (
                await Event.findOne({
                    eventType: 'mention',
                    permlink,
                    fromUsers: author,
                    user,
                })
            ) {
                return;
            }

            if (await this._isInBlackList(author, user)) {
                continue;
            }

            let comment, actor, post;

            try {
                const response = await this.callPrismService(
                    {
                        userId: author,
                        contentId: {
                            userId: author,
                            refBlockNum,
                            permlink,
                        },
                    },
                    contractName
                );
                if (response.comment && response.comment.parentPost) {
                    post = response.comment.parentPost;
                    comment = response.comment;
                } else {
                    post = response.post;
                }
                actor = response.user;
            } catch (error) {
                return;
            }

            const type = 'mention';

            const model = new Event({
                blockNum,
                refBlockNum,
                user,
                eventType: type,
                permlink,
                parentPermlink,
                fromUsers: [actor],
                post,
                comment,
                actor,
                author,
            });

            await model.save();

            this.emit('registerEvent', user, model.toObject());
        }
    }

    _extractMention(title, body) {
        const re = /(?<=\s|^)@[a-z][a-z\d.-]+(?:@[a-z][a-z\d]+)?(?=\s|$)/gi;
        const inTitle = title.match(re) || [];
        const inBody = body.match(re) || [];
        const totalRaw = inTitle.concat(inBody);
        const total = totalRaw.map(v => v.slice(1));

        return new Set(total);
    }
}

module.exports = Mention;
