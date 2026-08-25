import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import * as crypto from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

const configPath = resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ORG_PREFIX = "demo-org-";

function generateUUID() {
  return crypto.randomUUID();
}

async function seedData() {
  console.log("Authenticating anonymously...");
  await signInAnonymously(auth);
  console.log("Authenticated as:", auth.currentUser?.uid);

  console.log("Starting Demo Data Seeding...");
  const batch = writeBatch(db);

  // Check if demo orgs exist
  const orgsQuery = query(collection(db, "organizations"), where("isDemo", "==", true));
  const existingOrgs = await getDocs(orgsQuery);
  if (!existingOrgs.empty) {
    console.log("Demo data already exists. Skipping seeding.");
    process.exit(0);
  }

  const demoOrgs = [
    { name: "Acme Corp", code: "ACME" },
    { name: "Globex Corporation", code: "GLBX" },
    { name: "Stark Industries", code: "STRK" }
  ];

  for (const orgData of demoOrgs) {
    const orgId = ORG_PREFIX + generateUUID();
    const ownerId = "demo-user-" + generateUUID();
    
    // Organization
    const orgDoc = doc(db, "organizations", orgId);
    batch.set(orgDoc, {
      organizationId: orgId,
      organizationName: orgData.name,
      orgCode: orgData.code,
      ownerUid: ownerId,
      ownerEmail: `owner@${orgData.name.replace(/\s+/g, '').toLowerCase()}.demo`,
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true, // For easy cleanup later
      subscriptionPlan: "Enterprise"
    });

    // Users
    const roles = ["Super Admin", "Admin", "Organizer", "Manager", "Employee"];
    const users = [];

    // Owner (Super Admin or Organizer)
    const ownerDoc = doc(db, "users", ownerId);
    batch.set(ownerDoc, {
      uid: ownerId,
      email: `owner@${orgData.name.replace(/\s+/g, '').toLowerCase()}.demo`,
      displayName: `CEO of ${orgData.name}`,
      role: "Organizer",
      organizationId: orgId,
      organizationName: orgData.name,
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true
    });
    users.push(ownerId);

    // Create a Manager
    const managerId = "demo-user-" + generateUUID();
    const managerDoc = doc(db, "users", managerId);
    batch.set(managerDoc, {
      uid: managerId,
      email: `manager@${orgData.name.replace(/\s+/g, '').toLowerCase()}.demo`,
      displayName: `Manager at ${orgData.name}`,
      role: "Manager",
      organizationId: orgId,
      organizationName: orgData.name,
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true
    });
    users.push(managerId);

    // Create Employees
    const employeeIds = [];
    for (let i = 1; i <= 3; i++) {
      const empId = "demo-user-" + generateUUID();
      const empDoc = doc(db, "users", empId);
      batch.set(empDoc, {
        uid: empId,
        email: `emp${i}@${orgData.name.replace(/\s+/g, '').toLowerCase()}.demo`,
        displayName: `Employee ${i} (${orgData.name})`,
        role: "Employee",
        organizationId: orgId,
        organizationName: orgData.name,
        status: "active",
        createdAt: new Date().toISOString(),
        isDemo: true
      });
      employeeIds.push(empId);
      users.push(empId);
    }

    // Teams
    const teamId = "demo-team-" + generateUUID();
    const teamDoc = doc(db, "teams", teamId);
    batch.set(teamDoc, {
      id: teamId,
      organizationId: orgId,
      name: "Engineering Team",
      managerId: managerId,
      members: [managerId, ...employeeIds],
      createdAt: new Date().toISOString(),
      isDemo: true
    });

    // Subscriptions
    const subId = "demo-sub-" + generateUUID();
    const subDoc = doc(db, "subscriptions", subId);
    batch.set(subDoc, {
      id: subId,
      organizationId: orgId,
      plan: "Enterprise",
      status: "active",
      billingCycle: "annual",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isDemo: true
    });
  }

  await batch.commit();
  console.log("Demo Data Seeded Successfully!");
  process.exit(0);
}

seedData().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
