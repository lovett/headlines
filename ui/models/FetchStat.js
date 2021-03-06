'use strict';

import Base from './Base';
import DateTimeMixin from '../mixins/DateTime';
import PopulateMixin from '../mixins/Populate';

export default class FetchStat extends PopulateMixin(DateTimeMixin(Base)) {

    constructor(data) {
        super();
        this.created = null;
        this.httpStatus = null;
        this.entryCount = null;
        this.populate(data);
    }

    set created(value) {
        this._created = new Date(value * 1000);
    }

    get created() {
        return this.toTimeAndDate(this._created);
    }
}
