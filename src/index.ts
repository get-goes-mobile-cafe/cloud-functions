import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GeoCollectionReference, GeoFirestore, GeoQuery, GeoQuerySnapshot } from 'geofirestore';

admin.initializeApp();

export const hashLocation = functions.firestore.document('stops/{stopId}').onWrite((change, context) => {
    const data = change.after.data();

    if (data === undefined) {
        return
    }

    const location = data["location"];
 //    let locationHash = geohash.encode(location.latitude, location.longitude, 12);
 
    const geofirestore = new GeoFirestore(admin.firestore());
    const stopsGeoCollection = geofirestore.collection('stops');
 
    return stopsGeoCollection.doc(context.params.stopId).set({
        coordinates: new admin.firestore.GeoPoint(location.latitude, location.longitude)
    }, { merge: true });
 });

//  export const vendorCategoryChange = functions.firestore.document('vendor/{vendorId}/categories/{categoryId}').onWrite(async (change, context) => {
//      const data = change.after.data();
//      const vendorId = context.params.vendorId
//      const categoryId = context.params.categoryId
//  });

//  const updateVendorMenu = async function(vendorId: string) {
//     //  promises.push(admin.firestore().collection(`vendors/${vendorId}/subcategories`).get())
//     //  promises.push(admin.firestore().collection(`vendors/${vendorId}/items`).get())
//     //  promises.push(admin.firestore().collection(`vendors/${vendorId}/modifierSets`).get())

//      const categorySnapshots = await admin.firestore().collection(`vendors/${vendorId}/categories`).get()
//      const subcategorySnapshots = await admin.firestore().collection(`vendors/${vendorId}/subcategories`).get()
//      const itemSnapshots = await admin.firestore().collection(`vendors/${vendorId}/items`).get()
//      const modifierSetSnapshots = await admin.firestore().collection(`vendors/${vendorId}/modifierSets`).get()
     
//      const categories: any[] = []
//      categorySnapshots.forEach(category => {
//          const data = category.data()

//      })
//  }
 
 export const getNearbyStopsFromLocation = functions.https.onCall(async (data, context) => {
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
        const promises: any[] = []
        stopsSnapshot.docs.forEach(stop => {
            const p = admin.firestore().doc(`stops/${stop.id}`).get()
            promises.push(p)
        })

        const snapshots = await Promise.all(promises)

        const results: any[] = []
        snapshots.forEach(snap => {
            const stopData = snap.data()
            stopData.id = snap.id
            results.push(stopData)
        })

        return results
     } catch (error) {
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