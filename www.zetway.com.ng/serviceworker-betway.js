var staticCacheName = 'bw-v1';
var clients = null;
var pushFrom = null;
var ENABLE_BROWSER_CACHING = false;
self.importScripts('/scripts/clientsidecache.js');
self.addEventListener('notificationclick', function(event) {
    const clickedNotification = event.notification;
    clickedNotification.close();
    sendPushAnalyticsEvent(pushFrom, 'Web Notification', event.notification.title, 'Notification Clicked', event.notification.data);
    event.waitUntil(clients.openWindow(event.notification.data.url));
});
self.addEventListener('push', function(event) {
    if (event.isTrusted) {
        var notificationEvent = JSON.parse(event.data.text())
        console.log('[Service Worker] Push Message Received');
        pushFrom = notificationEvent.from;
        const title = notificationEvent.notification.title;
        const options = {
            body: notificationEvent.notification.body,
            icon: notificationEvent.notification.icon,
            image: notificationEvent.notification.image,
            badge: notificationEvent.notification.badge,
            requireInteraction: notificationEvent.notification.requireInteraction,
            tag: notificationEvent.notification.title,
            data: notificationEvent.data
        };
        sendPushAnalyticsEvent(pushFrom, 'Web Notification', title, 'Notification Received', options.data);
        event.waitUntil(self.registration.showNotification(title, options));
    }
});
self.addEventListener('install', function(event) {
    console.log("[Service Worker] Installing.");
    ENABLE_BROWSER_CACHING = (new URL(location).searchParams.get('enableBrowserCaching') === 'true');
    event.waitUntil(caches.open(staticCacheName).then(function(cache) {
        if (cache !== undefined) {
            return cache.addAll(['/manifest-betway.json']);
        }
    }));
});
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating.');
    event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function(event) {
    console.log("[Service Worker] 'fetch' event.");
    if (event.request.url.indexOf('/browser-sync/') !== -1) {
        if (ENABLE_BROWSER_CACHING) {
            clientSideCachePassthrough(event);
        }
        event.respondWith(fetch(event.request));
        return;
    }
    if (ENABLE_BROWSER_CACHING) {
        clientSideCachePassthrough(event);
    }
});
var deferredPrompt = null;
var userAccepted = false;
var allowADHS = null;
if (typeof(self.localStorage) !== 'undefined') {
    allowADHS = self.localStorage.getItem("AllowADHS");
}
if (typeof(allowADHS) === 'undefined' || allowADHS === null || allowADHS === '') {
    self.addEventListener('beforeinstallprompt', function(e) {
        console.log("[Service Worker] beforeinstallprompt");
        e.preventDefault();
        deferredPrompt = e;
        if (isMobile && (typeof(allowADHS) === 'undefined' || allowADHS === '')) {
            showAddToHomeScreen();
        }
    });
}

function addToHomeScreen() {
    var a2hsBtn = document.querySelector(".ad2hs-prompt");
    a2hsBtn.style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
            userAccepted = true;
            console.log('User accepted the A2HS prompt');
            if (typeof(self.localStorage) !== 'undefined') {
                self.localStorage.setItem("AllowADHS", "Yes");
                console.log("Saving user response: Yes");
            }
        } else {
            console.log('User dismissed the A2HS prompt');
            if (typeof(self.localStorage) !== 'undefined') {
                console.log("Saving user response: No");
                self.localStorage.setItem("AllowADHS", "No");
            }
        }
        deferredPrompt = null;
        var a2hsBtn = document.querySelector(".ad2hs-prompt");
        a2hsBtn.style.display = "none";
    });
}

function showAddToHomeScreen() {
    var a2hsBtn = document.querySelector(".ad2hs-prompt");
    a2hsBtn.style.display = "block";
    a2hsBtn.addEventListener("click", addToHomeScreen);
}
var trackingId = 'UA-1515961-20';

function sendPushAnalyticsEvent(clientId, eventCategory, eventAction, eventLabel, data) {
    'use strict';
    if (!trackingId) {
        console.error('You need your tracking ID in analytics-helper.js');
        console.error('Add this code:\nvar trackingId = \'UA-XXXXXXXX-X\';');
        return Promise.resolve();
    }
    if (!eventAction && !eventCategory && !eventLabel) {
        console.warn('sendAnalyticsEvent() called with no eventAction or eventCategory or eventLabel.');
        return Promise.resolve();
    }
    var payloadData = {
        v: 1,
        cid: clientId,
        tid: trackingId,
        t: 'event',
        ec: eventCategory,
        ea: eventAction,
        el: eventLabel,
        cm3: Number(data.workflowQueueId),
        cm4: data.sent,
        cd35: data.url
    };
    var payloadString = Object.keys(payloadData).filter(function(key) {
        return payloadData[key];
    }).map(function(key) {
        return key + '=' + encodeURIComponent(payloadData[key]);
    }).join('&');
    fetch(`https://www.google-analytics.com/collect?${payloadString}`, {
        method: 'get'
    }).then(function(response) {
        if (!response.ok) {
            return response.text().then(function(responseText) {
                throw new Error(`Bad response from Google Analytics: ${response.status}`, responseText);
            });
        } else {
            console.log('Hit sent, check the Analytics dashboard');
        }
    }).catch(function(err) {
        console.warn('Unable to send the analytics event', err);
    });
    return Promise.resolve();
}