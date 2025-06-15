// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB6gKwbxUL3vUUiPZRAGP3mUGdHIZ95GBI",
  authDomain: "shhh-chat-notifications.firebaseapp.com",
  projectId: "shhh-chat-notifications",
  storageBucket: "shhh-chat-notifications.firebasestorage.app",
  messagingSenderId: "61316322469",
  appId: "1:61316322469:web:275336786410153811694c"
};

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/path/to/your/icon.png' // Optional: a URL to an icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
