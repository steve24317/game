const DEBUG = false;
const CACHE_DB_VERSION = 1.1;
const CACHE_DB_STORE_NAME = 'idx_event_store';
const CACHE_VERSION = 1.1;
const CACHING_DURATION = 120;
const CURRENT_CACHES = {
    clientreq: 'client-side-cache-v' + CACHE_VERSION
};
const CURRENT_CACHE_ITEMS_READ = [/banner/i, /account\/messages/i, /account\/freebet/i, /offers/i, /mybets/i];
const CURRENT_CACHE_ITEMS_READWRITE = [/deletemessage/i, /updatemessage/i, /confirmbetslip/i, /acceptoffer/i, /searchTerm/i];
const URL_SEG_CORRELATION = ['banner', 'message', 'bet', 'offer', 'mybets'];
var idb;
var store;

function createIndexDB() {
    if (self.indexedDB) {
        try {
            console.log('[Service Worker] Installing clientside cache index db');
            var request = self.indexedDB.open('clientCacheIndexDB', CACHE_DB_VERSION);
            request.onsuccess = function(event) {
                idb = event.target.result;
                console.log('[Service Worker] Clientside cache index db active');
            };
            request.onerror = function(event) {
                handleException(`An error occurred during idb creation, error => ${request.error} event => ${event}`);
            };
            request.onupgradeneeded = function(event) {
                idb = event.target.result;
                store = idb.createObjectStore(CACHE_DB_STORE_NAME, {
                    keyPath: 'resource_id'
                });
                store.createIndex('idx_event_id', 'resource_id', {
                    unique: true
                });
            };
        } catch (e) {
            handleException(`An unexpected error occurred in \'createIndexDB()\' => ${e}`);
        }
    }
}

function InsertIdxDB(_id, _correlation, _expirationDate) {
    try {
        var transaction = idb.transaction(CACHE_DB_STORE_NAME, 'readwrite');
        var objectStore = transaction.objectStore(CACHE_DB_STORE_NAME);
        transaction.onerror = function(event) {
            handleException(`An unexpected error occurred in \'transaction()\' => while trying to add resource_id to store. Event => ${event}`);
        };
        transaction.onabort = function(event) {
            handleException(`An unexpected error occurred in  \'transaction()\' => while trying to add resource_id to store. Event => ${event}`);
        };
        var db_op_req = objectStore.add({
            resource_id: _id,
            correlation: _correlation,
            expirationDate: _expirationDate
        });
        db_op_req.onerror = function(event) {
            handleException(`An unexpected error occurred in  \'objectStore.add()\' => while trying to add { resource_id: _id, correlation: _correlation, expirationDate: _expirationDate } to store. Event => ${event}`);
        }
    } catch (e) {
        handleException(`An unexpected error occurred in \'InsertIdxDB()\' => ${e}`);
    }
}

function ReadIdxDB(_id) {
    return new Promise((resolve, reject) => {
        try {
            var transaction = idb.transaction(CACHE_DB_STORE_NAME, 'readwrite');
            var objectStore = transaction.objectStore(CACHE_DB_STORE_NAME);
            transaction.onerror = function(event) {
                handleException(`An unexpected error occurred in \'transaction()\' => while trying to retrieve resource_id from store. Event => ${event}`);
            };
            transaction.onabort = function(event) {
                handleException(`An unexpected error occurred in  \'transaction()\' => while trying to retrieve resource_id from store. Event => ${event}`);
            };
            var result = objectStore.get(_id);
            result.onerror = function(event) {
                handleException(`An unexpected error occurred in  \'objectStore.get()\' => while trying to retrieve resource_id from store. Event => ${event}`);
                reject();
            };
            result.onsuccess = function(event) {
                resolve(this.result);
            }
        } catch (e) {
            handleException(`An unexpected error occurred in \'ReadIdxDB()\' => ${e}`);
        }
    });
}

function RemoveIdxDB(_id) {
    try {
        var transaction = idb.transaction(CACHE_DB_STORE_NAME, 'readwrite');
        var objectStore = transaction.objectStore(CACHE_DB_STORE_NAME);
        transaction.onerror = function(event) {
            handleException(`An unexpected error occurred in \'transaction()\' => while trying to remove resource_id from store. Event => ${event}`);
        };
        transaction.onabort = function(event) {
            handleException(`An unexpected error occurred in  \'transaction()\' => while trying to remove resource_id from store. Event => ${event}`);
        };
        objectStore.delete(_id);
    } catch (e) {
        handleException(`An unexpected error occurred in \'RemoveIdxDB()\' => ${e}`);
    }
}

function RemoveExpiredIdxDB() {
    try {
        var transaction = idb.transaction(CACHE_DB_STORE_NAME, 'readwrite');
        var objectStore = transaction.objectStore(CACHE_DB_STORE_NAME);
        transaction.onerror = function(event) {
            handleException(`An unexpected error occurred in \'transaction()\' => while trying to remove resource_id to store. Event => ${event}`);
        };
        transaction.onabort = function(event) {
            handleException(`An unexpected error occurred in  \'transaction()\' => while trying to remove resource_id to store. Event => ${event}`);
        };
        var request = objectStore.openCursor();
        request.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if (cursor.value) {
                    var result = cursor.value.expirationDate;
                    if (result != null && typeof(result) != 'undefined') {
                        const expirationDate = result;
                        const now = new Date();
                        if (expirationDate <= now) {
                            cursor.delete();
                            if (DEBUG) console.log('Info: Cache item expire, removing from cursor / index db');
                        }
                    }
                }
                cursor.continue();
            }
        };
    } catch (e) {
        handleException(`An unexpected error occurred in \'RemoveExpiredIdxDB()\' => ${e}`);
    }
}

function RemoveAllSegCorrelateIdxDB(_seg) {
    try {
        var transaction = idb.transaction(CACHE_DB_STORE_NAME, 'readwrite');
        var objectStore = transaction.objectStore(CACHE_DB_STORE_NAME);
        transaction.onerror = function(event) {
            handleException(`An unexpected error occurred in \'transaction()\' => while trying to remove resource_id to store. Event => ${event}`);
        };
        transaction.onabort = function(event) {
            handleException(`An unexpected error occurred in  \'transaction()\' => while trying to remove resource_id to store. Event => ${event}`);
        };
        var request = objectStore.openCursor();
        request.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if (cursor.value) {
                    var correlation = cursor.value.correlation;
                    var expiration = cursor.value.expirationDate;
                    if (correlation != null && typeof(correlation) != 'undefined' && expiration != null && typeof(expiration) != 'undefined') {
                        const now = new Date();
                        if (expiration <= now) {
                            cursor.delete();
                            DeleteSegFromCaches(_seg);
                            if (DEBUG) console.log('Info: Cache item expire, removing from cursor / index db and cache storage');
                        } else if (correlation == _seg) {
                            cursor.delete();
                            DeleteSegFromCaches(_seg);
                            if (DEBUG) console.log('Info: Cache item correlation match found, removing from cursor / index db and cache storage');
                        }
                    }
                }
                cursor.continue();
            }
        };
    } catch (e) {
        handleException(`An unexpected error occurred in \'RemoveAllSegCorrelateIdxDB()\' => ${e}`);
    }
}

function DeleteSegFromCaches(_seg) {
    try {
        self.caches.open(CURRENT_CACHES.clientreq).then(function(cache) {
            cache.keys().then(keys => {
                keys.forEach(key => {
                    if (key.url.toLowerCase().match(_seg)) {
                        cache.delete(key);
                    }
                });
            });
        });
    } catch (e) {
        handleException(`An unexpected error occurred in \'DeleteSegFromCaches()\' => ${e} `);
    }
}

function handleException(_e) {
    if (DEBUG) {
        console.log("Error: " + _e);
    }
}
self.addEventListener('activate', function(event) {
    var expectedCacheNamesSet = new Set(Object.values(CURRENT_CACHES));
    event.waitUntil(caches.keys().then(function(cacheNames) {
        return Promise.all(cacheNames.map(function(cacheName) {
            if (!expectedCacheNamesSet.has(cacheName)) {
                if (DEBUG) console.log('Warning: Deleting out of date cache:', cacheName);
                return caches.delete(cacheName);
            }
        }));
    }));
    event.waitUntil(createIndexDB());
});

function clientSideCachePassthrough(event) {
    event.respondWith(caches.open(CURRENT_CACHES.clientreq).then(function(cache) {
        if (typeof(cache) == "undefined" || cache == null) {
            return fetch(event.request);
        }
        if (!event.request.url.toLowerCase().match(self.location.hostname.toLowerCase())) {
            if (DEBUG) {
                console.log('Warning: Potential cross-origin request');
                console.log(`From: origin: ${self.location.hostname.toLowerCase()} to remote: ${event.request.url.toLowerCase()} `);
            }
            return fetch(event.request);
        }
        return cache.match(event.request).then(function(response) {
            var containsRead = false;
            var containsRW = false;
            CURRENT_CACHE_ITEMS_READ.forEach(x => {
                if (event.request.url.match(x)) {
                    containsRead = true;
                }
            });
            CURRENT_CACHE_ITEMS_READWRITE.forEach(x => {
                if (event.request.url.match(x)) {
                    containsRW = true;
                }
            });
            if (response && containsRead) {
                ReadIdxDB(event.request.url.toLowerCase()).then(function(result) {
                    if (result != null && typeof(result) != 'undefined') {
                        const expirationDate = Date.parse(result.expirationDate);
                        const now = new Date();
                        if (expirationDate < now) {
                            if (DEBUG) console.log('Warning: Expired, removing from cache');
                            cache.delete(event.request);
                            RemoveExpiredIdxDB();
                        }
                    }
                });
                return response;
            } else if (containsRW) {
                var segFiltered = URL_SEG_CORRELATION.filter(x => event.request.url.toLowerCase().indexOf(x) > 1);
                if (segFiltered.length >= 1) {
                    var seg = segFiltered[0];
                    if (seg != null && typeof(seg) !== 'undefined') {
                        RemoveAllSegCorrelateIdxDB(seg);
                    }
                }
            }
            return fetch(event.request.clone()).then(function(liveResponse) {
                if (liveResponse.status < 400 && containsRead) {
                    const expires = new Date();
                    expires.setSeconds(expires.getSeconds() + CACHING_DURATION, );
                    if (DEBUG) console.log('Info: Matching request found, caching the response');
                    cache.put(event.request, liveResponse.clone());
                    var segFiltered = URL_SEG_CORRELATION.filter(x => event.request.url.toLowerCase().indexOf(x) > 1);
                    if (segFiltered.length >= 1) {
                        var seg = segFiltered[0];
                        if (seg != null && typeof(seg) !== 'undefined') {
                            InsertIdxDB(event.request.url.toLowerCase(), seg, expires);
                        }
                    }
                }
                return liveResponse;
            });
        }).catch(function(error) {
            console.error('Error: Fetch handler:', error);
            throw error;
        });
    }));
}