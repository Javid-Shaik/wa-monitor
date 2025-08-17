export function printObjectRecursive(obj, indent = '') {
  for (const key in obj) {
    // Ensure the property belongs to the object itself, not its prototype chain
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'object' && value !== null) {
        // If the value is an object (and not null), recurse
        console.log(`${indent}${key}: {`);
        printObjectRecursive(value, indent + '  '); // Increase indent for nested objects
        console.log(`${indent}}`);
      } else {
        // Otherwise, print the key-value pair
        console.log(`${indent}${key}: ${value}`);
      }
    }
  }
}

async function sendNotification(phoneNumber, status) {
    try {
        const userDoc = await admin.firestore().collection("users").doc(phoneNumber).get();
        if (!userDoc.exists) {
            console.error(` No FCM token found for ${phoneNumber}`);
            return;
        }

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
            console.error(` User ${phoneNumber} has no FCM token.`);
            return;
        }

        const message = {
            notification: {
                title: "WhatsApp Status Update",
                body: `${phoneNumber} is ${status}`,
            },
            token: fcmToken,
        };

        await admin.messaging().send(message);
        console.log(` Notification sent for ${phoneNumber} (${status})`);
    } catch (error) {
        console.error(" Error sending notification:", error);
    }
}
