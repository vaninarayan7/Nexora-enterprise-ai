import { db } from "./lib/firebaseDb";
import { auth } from "./lib/firebase";
import { collection, doc, setDoc, getDoc, getDocs, writeBatch, query, where } from "firebase/firestore";

const ORG_PREFIX = "demo-org-";

function generateUUID() {
  return crypto.randomUUID();
}

export async function seedDemoData() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error("You must be logged in to seed demo data (to respect permissions).");
    return;
  }

  console.log("Starting Demo Data Seeding as user:", currentUser.uid);
  const batch = writeBatch(db);

  // Check if demo orgs exist
  const orgsQuery = query(collection(db, "organizations"), where("isDemo", "==", true));
  const existingOrgs = await getDocs(orgsQuery);
  if (!existingOrgs.empty) {
    console.log("Demo data already exists. Skipping seeding.");
    return;
  }

  // Also check if current user's organization has tasks
  let targetOrgId = ORG_PREFIX + generateUUID();
  let ownerId = currentUser.uid;

  // Find if user already belongs to an organization
  const userDocRef = doc(db, "users", currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  let hasRealOrg = false;
  if (userDocSnap.exists()) {
     const udata = userDocSnap.data();
     if (udata.organizationId) {
        targetOrgId = udata.organizationId;
        hasRealOrg = true;
     }
  }

  // If user has a real org, we just seed tasks/teams into their org!
  if (hasRealOrg) {
    console.log("User belongs to org:", targetOrgId, "- seeding tasks & teams into it.");
  } else {
    // Organization
    const orgDoc = doc(db, "organizations", targetOrgId);
    batch.set(orgDoc, {
      organizationId: targetOrgId,
      organizationName: "Acme Corp (Demo)",
      orgCode: "ACME",
      ownerUid: ownerId,
      ownerEmail: currentUser.email || `owner@acme.demo`,
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true, 
      subscriptionPlan: "Enterprise"
    });

    // Owner Profile (Using current user)
    const ownerDoc = doc(db, "users", ownerId);
    batch.set(ownerDoc, {
      uid: ownerId,
      email: currentUser.email || `owner@acme.demo`,
      displayName: currentUser.displayName || `CEO of Acme Corp`,
      role: "Super Admin", // Give highest privileges to owner
      organizationId: targetOrgId,
      organizationName: "Acme Corp (Demo)",
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true
    }, { merge: true });
  }

  // Create a Manager
  const managerId = "demo-user-" + generateUUID();
  const managerDoc = doc(db, "users", managerId);
  batch.set(managerDoc, {
    uid: managerId,
    email: `manager@acme.demo`,
    displayName: `Project Manager`,
    role: "Manager",
    organizationId: targetOrgId,
    organizationName: "Acme Corp (Demo)",
    status: "active",
    createdAt: new Date().toISOString(),
    isDemo: true
  });

  // Create Employees
  const employeeIds = [];
  const employees = [];
  for (let i = 1; i <= 4; i++) {
    const empId = "demo-user-" + generateUUID();
    const displayName = `Developer ${i}`;
    const empDoc = doc(db, "users", empId);
    batch.set(empDoc, {
      uid: empId,
      email: `dev${i}@acme.demo`,
      displayName: displayName,
      role: "Employee",
      organizationId: targetOrgId,
      organizationName: "Acme Corp (Demo)",
      status: "active",
      createdAt: new Date().toISOString(),
      isDemo: true
    });
    employeeIds.push(empId);
    employees.push({ id: empId, name: displayName });
  }

  // Teams
  const teamId = "demo-team-" + generateUUID();
  const teamDoc = doc(db, "teams", teamId);
  batch.set(teamDoc, {
    id: teamId,
    organizationId: targetOrgId,
    name: "Engineering Squad Alpha",
    managerId: managerId,
    members: [managerId, ...employeeIds],
    createdAt: new Date().toISOString(),
    isDemo: true
  });

  // Departments
  const deptId = "demo-dept-" + generateUUID();
  const deptDoc = doc(db, "departments", deptId);
  batch.set(deptDoc, {
    id: deptId,
    organizationId: targetOrgId,
    name: "Product Development",
    headId: managerId,
    createdAt: new Date().toISOString(),
    isDemo: true
  });

  // Generate Kanban Tasks (To Do, In Progress, Review, Completed)
  const taskData = [
    { title: "Design System Overhaul", desc: "Refactor core UI components for the upcoming v3.0 release. Deliverable: Figma spec and React components.", status: "todo", priority: "high", assignee: employees[0] },
    { title: "Implement OAuth 2.0 Provider", desc: "Integrate Google and GitHub single sign-on flows. Project: Authentication revamp.", status: "progress", priority: "high", assignee: employees[1] },
    { title: "Database Migration Script", desc: "Write backward-compatible script to migrate user preferences to JSONB. Deliverable: SQL migration file.", status: "review", priority: "medium", assignee: employees[2] },
    { title: "Optimize Vector Search Query", desc: "Reduce latency on RAG pipeline by tuning pgvector indices. Project: Performance.", status: "completed", priority: "medium", assignee: employees[3] },
    { title: "Draft Q3 Engineering OKRs", desc: "Coordinate with tech leads to finalize quarterly goals.", status: "todo", priority: "low", assignee: { id: managerId, name: "Project Manager" } },
    { title: "Fix Pagination Bug on Dashboard", desc: "Users report that page 3 skips records. Needs hotfix.", status: "progress", priority: "high", assignee: employees[0] },
    { title: "Update API Documentation", desc: "Document the new /v2/analytics endpoints in Swagger.", status: "review", priority: "low", assignee: employees[1] },
    { title: "Deploy Kubernetes Cluster", desc: "Provision production nodes on GCP with auto-scaling configured.", status: "completed", priority: "high", assignee: employees[2] }
  ];

  taskData.forEach((t) => {
    const taskId = "demo-task-" + generateUUID();
    const taskDoc = doc(db, "tasks", taskId);
    
    // We add BOTH `assignee` (for TaskWorkspace) and `assigneeName`/`assigneeId` (for ManagerDashboard)
    // We also use `organizationId` which is REQUIRED for getTasks query!
    batch.set(taskDoc, {
      id: taskId,
      organizationId: targetOrgId, // Critical for filtering
      title: t.title,
      description: t.desc,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assignee.id,
      assigneeName: t.assignee.name,
      assignee: t.assignee.name, // TaskWorkspace uses this
      creatorId: ownerId,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Created 2 days ago
      updatedAt: new Date().toISOString(),
      isDemo: true
    });
  });

  try {
    await batch.commit();
    console.log("Demo Data Seeded Successfully!");
  } catch (error) {
    console.error("Seeding failed.", error);
  }
}

// Expose globally for execution via browser console
(window as any).seedDemoData = seedDemoData;
