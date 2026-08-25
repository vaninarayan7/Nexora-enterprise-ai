import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, query, where, getDocs, deleteDoc } from "firebase/firestore";
import * as crypto from "crypto";
import { readFileSync } from "fs";

// Read Firebase config from the project environment if possible, or just use emulator
const firebaseConfig = {
  projectId: "demo-aether-ai",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runTest() {
  console.log("Starting Invitation Flow Test...");

  const token = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const orgId = crypto.randomUUID();

  const newInv = {
    id: inviteId,
    organizationId: orgId,
    inviterId: "test-inviter",
    email: "test@example.com",
    role: "Employee",
    token,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  console.log(`1. Generating Invitation with ID: ${inviteId}`);
  console.log(`2. Generated Token Field: "${token}"`);
  
  const docRef = doc(db, "invitations", inviteId);
  await setDoc(docRef, newInv);
  console.log(`3. Successfully saved to Firestore!`);

  console.log(`4. Attempting Lookup using: where("token", "==", "${token}")`);
  const q = query(collection(db, "invitations"), where("token", "==", token));
  const snap = await getDocs(q);

  console.log(`5. Returned documents count: ${snap.size}`);

  if (!snap.empty) {
    const fetched = snap.docs[0].data();
    console.log(`6. Lookup SUCCESS! Fetched Token: "${fetched.token}"`);
    console.log(`   Tokens Match? ${fetched.token === token}`);
  } else {
    console.log(`6. Lookup FAILED! Token not found in query.`);
    console.log(`   Fetching all documents in 'invitations' collection to verify...`);
    const allSnap = await getDocs(collection(db, "invitations"));
    let found = false;
    allSnap.forEach(d => {
      const data = d.data();
      if (data.id === inviteId) {
        console.log(`   --> Found document by ID: ${d.id}`);
        console.log(`   --> Document Token: "${data.token}"`);
        console.log(`   --> Match? ${data.token === token}`);
        found = true;
      }
    });
    if (!found) {
      console.log(`   --> Document with ID ${inviteId} was completely missing from Firestore!`);
    }
  }

  await deleteDoc(docRef);
  console.log("Test Complete. Document cleaned up.");
  process.exit(0);
}

runTest().catch(e => {
  console.error("Test Failed:", e);
  process.exit(1);
});
