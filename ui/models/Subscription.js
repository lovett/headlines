'use strict';

import m from 'mithril';

let intervalId = null;

export default {
    endpoint: '/subscription',
    feeds: [],
    labels: {},
    fields: [],
    template: {},
    newFeed: {},
    fetchedOn: null,
    adding: false,
    editing: false,

    hasFeeds: function () {
        return this.feeds.length > 0;
    },

    hasFetched: function() {
        return this.fetchedOn !== null;
    },

    getLabel: function (key) {
        return this.labels[key];
    },

    load: function () {
        this.fetchedOn = Math.floor(Date.now() / 1000);
        return m.request({
            method: 'GET',
            url: `${this.endpoint}?${this.fetchedOn}`,
            withCredentials: true
        }).then((res) => {
            this.feeds =  res.data.feeds;
            this.labels = res.meta.labels;
            this.fields = res.meta.fields;
            this.template = res.meta.template;
            this.newFeed = Object.assign({}, res.meta.template);
        });
    },

    stopPolling: function () {
        clearInterval(intervalId);
        intervalId = null;
    },

    startPolling: function (intervalSeconds=3) {
        if (intervalId !== null) {
            return;
        }

        this.poll();
        this.intervalId = setInterval(this.poll.bind(this), intervalSeconds * 1000);
    },

    poll: function () {
        // Fetch if this is the first poll.
        if (this.hasFetched() === false) {
            this.load();
            return;
        }

        // Fetch if a feed has just been added.
        const newlyAdded = this.feeds.some((feed) => {
            const age = Math.abs(feed.subscribed - Date.now()/1000);
            return feed.entryCount === 0 && age < 20;
        });

        if (newlyAdded) {
            this.load();
            return;
        }

        // Fetch if any feeds have passed their nextFetch date.
        const stale = this.feeds.some((feed) => {
            if (feed.nextFetch < this.fetchedOn) {
                console.log(`${feed.title} is supposed to be fetched on ${new Date(feed.nextFetch)} but the last fetch by the ui was ${new Date(this.fetchedOn)} so the feed is stale`);
            }
            return feed.nextFetch < this.fetchedOn;
        });

        if (stale) {
            this.load();
            return;
        }
    },

    save: function (feed) {
        const method = (feed.id)? 'PUT' : 'POST';

        return m.request({
            method: method,
            url: this.endpoint,
            data: [feed],
            withCredentials: true
        }).then((res) => {
            this.load();
            this.adding = false;
            this.editing = false;
        }).catch((e) => {
            console.log(e);
        });
    },

    update: function (feed) {
        alert('Feed update has not yet been implemented.');
    },

    remove: function (feed) {
        return m.request({
            method: 'DELETE',
            url: this.endpoint,
            data: [feed.id],
            withCredentials: true
        }).then(() => {
            this.feeds = this.feeds.filter((item) => item !== feed);
        }).catch((e) => {
            console.log(e);
        });
    }
};
