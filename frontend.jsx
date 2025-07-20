import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { Bell, BellOff, Send, CheckCircle, AlertCircle } from 'lucide-react';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkqNfO9jT7A7AfXYCGjb51xqOD-1oVCSU",
  authDomain: "gaaih-mps-backed.firebaseapp.com",
  projectId: "gaaih-mps-backed",
  storageBucket: "gaaih-mps-backed.firebasestorage.app",
  messagingSenderId: "232996981905",
  appId: "1:232996981905:web:1ad805a6feacc75ea88330",
  measurementId: "G-TZ5S5YE27V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const PushNotificationApp = () => {
  const [token, setToken] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [permission, setPermission] = useState('default');
  const [isLoading, setIsLoading] = useState(false);
  const [testTitle, setTestTitle] = useState('Test Notification');
  const [testBody, setTestBody] = useState('This is a test notification from Firebase!');

  // Service Worker registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Check initial notification permission
  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  // Listen for foreground messages
  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received in foreground:', payload);
      const notification = {
        id: Date.now(),
        title: payload.notification?.title || 'New Message',
        body: payload.notification?.body || 'You have a new message',
        timestamp: new Date().toLocaleTimeString(),
        data: payload.data
      };
      setNotifications(prev => [notification, ...prev]);
    });

    return () => unsubscribe();
  }, []);

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await generateToken();
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateToken = async () => {
    try {
      const currentToken = await getToken(messaging, {
        vapidKey: 'BFrqoEAGsMkQmmko2l0nLLcAX5O-zkYUBvmBEBL3ZJ80jmc-vGlPvetfeATsCg3wxhJf4nyFQ79SFkGq13hXPAA' 
      });
      
      if (currentToken) {
        setToken(currentToken);
        console.log('FCM Token:', currentToken);
        // Send token to your server here
      } else {
        console.log('No registration token available.');
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
  };

  const sendTestNotification = async () => {
    if (!token) {
      alert('No FCM token available. Please enable notifications first.');
      return;
    }

    setIsLoading(true);
    try {
      // Send notification via your backend server
      const response = await sendNotificationToServer({
        token,
        title: testTitle,
        body: testBody
      });
      
      if (response.success) {
        alert('Test notification sent successfully!');
      } else {
        alert('Error: ' + response.error);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error sending notification');
    } finally {
      setIsLoading(false);
    }
  };

  // Send notification via backend server
  const sendNotificationToServer = async (data) => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error calling backend:', error);
      throw error;
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { icon: CheckCircle, color: 'text-green-600', text: 'Notifications enabled' };
      case 'denied':
        return { icon: AlertCircle, color: 'text-red-600', text: 'Notifications blocked' };
      default:
        return { icon: Bell, color: 'text-yellow-600', text: 'Permission not requested' };
    }
  };

  const permissionStatus = getPermissionStatus();
  const PermissionIcon = permissionStatus.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Bell className="text-blue-600" />
            Firebase Push Notifications
          </h1>
          <p className="text-gray-600">Manage and test push notifications with Firebase Cloud Messaging</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Permission & Token Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Notification Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <PermissionIcon className={`h-5 w-5 ${permissionStatus.color}`} />
                  <span className="font-medium">{permissionStatus.text}</span>
                </div>
                {permission !== 'granted' && (
                  <button
                    onClick={requestPermission}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Requesting...' : 'Enable'}
                  </button>
                )}
              </div>

              {token && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">FCM Token:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={token}
                      readOnly
                      className="flex-1 p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs"
                    />
                    <button
                      onClick={copyToken}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Send this token to your server to send push notifications to this device.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Test Notification Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Notification</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Notification title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Notification message"
                />
              </div>
              
              <button
                onClick={sendTestNotification}
                disabled={isLoading || !token}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isLoading ? 'Sending...' : 'Send Test Notification'}
              </button>
              
              {!token && (
                <p className="text-xs text-red-500 text-center">
                  Enable notifications first to send test notifications
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Received Notifications</h2>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Clear All
              </button>
            )}
          </div>
          
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BellOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No notifications received yet</p>
              <p className="text-sm">Notifications will appear here when received</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">{notification.title}</h3>
                      <p className="text-gray-600 mt-1">{notification.body}</p>
                      {notification.data && (
                        <pre className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded">
                          {JSON.stringify(notification.data, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-4">{notification.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Setup Instructions</h2>
          <div className="prose prose-sm text-gray-600">
            <ol className="space-y-2">
              <li>Firebase config with your project's configuration- Done</li>
              <li>Add your VAPID key in the generateToken function - Done</li>
              <li>Create a service worker file at /public/firebase-messaging-sw.js</li>
              <li>Implement server-side notification sending using Firebase Admin SDK</li>
              <li>Enable notifications and copy the FCM token</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationApp;




/**
 * add this file `firebase-messaging-sw.js` to your public directory
 * 
 * ```javascript 
 * 
 * 
 * // firebase-messaging-sw.js
// This file should be placed in the /public folder of your React app

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyAkqNfO9jT7A7AfXYCGjb51xqOD-1oVCSU",
  authDomain: "gaaih-mps-backed.firebaseapp.com",
  projectId: "gaaih-mps-backed",
  storageBucket: "gaaih-mps-backed.firebasestorage.app",
  messagingSenderId: "232996981905",
  appId: "1:232996981905:web:1ad805a6feacc75ea88330"
});

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages (when app is closed/minimized)
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received in service worker:', payload);
  
  // Extract notification data
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/firebase-logo.png', // You can change this to your app icon
    badge: '/badge-icon.png',   // Small badge icon (optional)
    tag: 'firebase-notification', // Prevents duplicate notifications
    data: payload.data || {},   // Custom data
    requireInteraction: false,  // Auto-hide after few seconds
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close(); // Close the notification
  
  // Handle different actions
  if (event.action === 'close') {
    return; // Just close the notification
  }
  
  // Default action or 'open' action - open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If app is not open, open it
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
 */