const fetch = require('node-fetch');
const { JsonRpc } = require('cyberwayjs');
const EventEmitter = require('events');
const core = require('gls-core-service');
const BasicController = core.controllers.Basic;
const Logger = core.utils.Logger;
const User = require('../../models/User');
const env = require('../../data/env');
const RPC = new JsonRpc(env.GLS_CYBERWAY_HTTP_URL, { fetch });

class Abstract extends BasicController {
    constructor({ connector }) {
        super({ connector });
        this._emitter = new EventEmitter();
    }

    async _handle(params, blockNum) {
        await this.waitForBlockNum(blockNum);
    }

    async resolveName(user) {
        let name = user;
        if (user.includes('@')) {
            try {
                const resolved = await RPC.fetch('/v1/chain/resolve_names', [user]);
                name = resolved[0].resolved_username;
            } catch (error) {
                Logger.warn('Error resolve account name -- ', JSON.stringify(error, null, 4));
                name = user.split('@')[0];
            }
        }
        Logger.info(`Resolving name -- ${name}`);
        return name;
    }

    _populatePrismRequestData(data, { userId, communityId, postId, commentId, contentId }) {
        if (postId) {
            // нужно делать именно так, чтобы гарантировать порядок полей
            data.postId = {
                userId: postId.userId,
                permlink: postId.permlink,
            };
        }

        if (commentId) {
            // нужно делать именно так, чтобы гарантировать порядок полей
            data.commentId = {
                userId: commentId.userId,
                permlink: commentId.permlink,
            };
        }

        if (contentId) {
            // нужно делать именно так, чтобы гарантировать порядок полей
            data.contentId = {
                userId: contentId.userId,
                permlink: contentId.permlink,
            };
        }

        if (userId) {
            data.userId = userId;
        }

        if (communityId) {
            data.communityId = communityId;
        }
    }

    async getEntityMetaData({ userId, communityId, postId, commentId, contentId }, app) {
        const data = { app };

        this._populatePrismRequestData(data, { userId, communityId, postId, commentId, contentId });

        try {
            return await this.callService('prism', 'getNotifyMeta', data);
        } catch (error) {
            Logger.error(
                `Error calling prism.getNotifyMeta in ${
                    this.constructor.name
                } with data:\n${JSON.stringify(data, null, 2)}\n`,
                error
            );

            error.prismError = true;

            throw error;
        }
    }

    async waitForBlockNum(blockNum, maxRetries = 5, retryNum = 0) {
        const params = { blockNum };

        try {
            return await this.callService('prism', 'waitForBlock', params);
        } catch (error) {
            const code = error.code;
            const isTimeOut = code === 408 || code === 'ECONNRESET' || code === 'ETIMEDOUT';

            if (isTimeOut && retryNum <= maxRetries) {
                return await this.waitForBlockNum(blockNum, maxRetries, ++retryNum);
            }

            Logger.error(`Error calling prism.waitForBlock`, error);

            error.prismError = true;

            throw error;
        }
    }

    emit(name, ...data) {
        this._emitter.emit(name, ...data);
    }

    on(name, callback) {
        this._emitter.on(name, callback);
    }

    async _isInBlackList(nameFrom, nameTo, app) {
        await this._initUser(nameTo, app);

        const count = await User.countDocuments({ name: nameTo, app, blackList: nameFrom });

        return count !== 0;
    }

    async _initUser(name, app) {
        return await User.updateOne({ name, app }, { $set: { name, app } }, { upsert: true });
    }
}

module.exports = Abstract;
