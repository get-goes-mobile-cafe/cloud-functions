import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import { GeoFirestore, GeoCollectionReference, GeoQuery, GeoQuerySnapshot } from 'geofirestore';

admin.initializeApp();

export const hashLocation = functions.firestore.document('stops/{stopId}').onWrite((change, context) => {
    const data = change.after.data();

    if (data === undefined) {
        return
    }

    const location = data["location"];
 
    const geofirestore = new GeoFirestore(admin.firestore());
    const stopsGeoCollection = geofirestore.collection('stops');
 
    return stopsGeoCollection.doc(context.params.stopId).set({
        coordinates: new admin.firestore.GeoPoint(location.latitude, location.longitude)
    }, { merge: true });
 });
 
 export const getNearbyStopsFromLocation = functions.https.onCall( async (data, context) => {
     const lat = data.lat;
     const lon = data.lon;
     const radius = data.radius;
 
     if(!(typeof lat === 'number' && typeof lon === 'number' && typeof radius === 'number')) {
         throw new functions.https.HttpsError('invalid-argument', 'The function must be called with ' +
         'three arguments "lat" "lon" "radius" containing the center location and radius to search.');
     }
 
     const geofirestore = new GeoFirestore(admin.firestore());
     const stopsGeoCollection: GeoCollectionReference = geofirestore.collection('stops');
 
     const stopsQuery: GeoQuery = stopsGeoCollection.near({ center: new admin.firestore.GeoPoint(lat, lon), radius: radius });

     try {
         const stopsSnapshot: GeoQuerySnapshot = await stopsQuery.get()
         return stopsSnapshot.docs
     } catch(error) {
         return error
     }
 });

 export const getVendorInfo = functions.https.onCall( async (data, context) => {
    const vendorId = data.vendorId;

    if(!(typeof vendorId === 'string')) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with ' +
        'one argument "vendorId" containing the if of the vendor to search.');
    }

    try {
        const vendorDocRef = admin.firestore().collection("vendors").doc(vendorId)
        const promises: any[] = []

        promises.push(vendorDocRef.get())
        promises.push(vendorDocRef.collection("categories").get())
        promises.push(vendorDocRef.collection("subcategories").get())
        promises.push(vendorDocRef.collection("items").get())
        promises.push(vendorDocRef.collection("modifierSets").get())

        const snapshots = await Promise.all(promises)
        
        const results: any[] = []
        snapshots.forEach(snap => {
            results.push(snap.data())
        })

        return results
    } catch (error) {
        return error
    }
});

export const notifyStopStatus = functions.https.onCall( async (data, contex) => {
    const stopId = data.stopId
    const stopName = data.stopName
    const stopStatus = data.stopStatus

    if(!(typeof stopId === 'string' && typeof stopName === 'string' && typeof stopStatus === 'number')) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with ' +
        'three arguments "stopId" as a string, "stopStatus" as a number, and "stopName" as a string')
    }

    var messageTitle = stopName
    var messageBody = ""

    switch(stopStatus) {
        case 0:
            messageBody = "We're no longer at this stop."
            break
        case 1:
            messageBody = "We'll be arriving shortly!"
            break
        case 2:
            messageBody = "We're here! Come meet us and place an order if you haven't already."
            break
        case 3:
            messageBody = "We'll be leaving soon!"
            break
        default:
            messageBody ="Not sure what's going on here"
    }

    var message = {
        notification: {
            title: messageTitle,
            body: messageBody
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                }
            },
        },
        topic: stopId + "-alerts"
    }

    admin.messaging().send(message)
        .then((response) => {
            console.log("successfully sent message: ", response)
            return response
        }).catch((error) => {
            console.log('Error sending message: ', error)
            return error
        })
})

export const notifyOrderStatus = functions.https.onCall( async (data, context) => {
    const stopName = data.stopName
    const orderUpdate = data.orderUpdate
    const customerId = data.customerId

    if(!(typeof(stopName) === 'string' && typeof(orderUpdate) === 'string' && typeof(customerId) === 'string')) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with ' +
        'three arguments "stopName" as a string, "orderId" as a string, and "customerId" as a string')
    }

    try {
        let userSnapshot = await admin.firestore().collection("users").doc(customerId).get()
        let userData = userSnapshot.data()
        if (userData != undefined) {
            let pnToken = userData["pnRegistrationToken"]

            let message = {
                notification: {
                    title: stopName + " - Order Updated",
                    body: orderUpdate
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                        }
                    }
                },
                token: pnToken
            }

            admin.messaging().send(message)
            .then((response) => {
                return response
            }).catch((error) => {
                console.log(error)
                return error
            })
        }
    } catch(error) {
        console.log(error)
        return error
    }
})

export const notifyAcceptingOrdersStatus = functions.https.onCall( async (data, context) => {
    const stopId = data.stopId
    const stopName = data.stopName
    const acceptingOrders = data.acceptingOrders
    const vendorName = data.vendorName

    if(!(typeof(stopId) === 'string' && typeof(acceptingOrders) === 'boolean' && typeof(stopName) === 'string'
        && typeof(vendorName) === 'string')) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with ' +
        'four arguments "stopId" as a string, "stopName" as a string, "vendorName" as a string, and "acceptingOrders" as a boolean')
    }

    let message = {
        notification: {
            title: acceptingOrders ? vendorName + " - Mobile Orders Open" : vendorName + " - Mobile Orders Closed",
            body: acceptingOrders ? "Place your orders through the app, or come meet us at " + stopName : 
                    "We are no longer accepting orders through the app",
            sound: "default"
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                }
            }
        },
        topic: stopId + "-alerts"
    }

    admin.messaging().send(message)
        .then((response) => {
            return response
        }).catch((error) => {
            return error
        })
})