import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import type {
  AutomationProject,
  SqaDefect,
  SqaRelease,
  SqaRequirement,
  SqaTestPlan,
  SqaTestSuite,
  TestCase,
  TestRunRecord,
  UserProfile,
} from '@/types';

const ALLOWED_ROLES = new Set([
  'sqa_engineer',
  'qa_lead',
  'developer',
  'project_manager',
  'viewer',
  'engineer',
]);

const ALLOWED_PRIORITIES = new Set(['Critical', 'High', 'Medium', 'Low']);
const ALLOWED_SEVERITIES = new Set(['Blocker', 'Critical', 'Major', 'Minor', 'Trivial']);
const ALLOWED_TC_STATUS = new Set(['pending', 'passed', 'failed', 'skipped']);
const ALLOWED_SQA_STATUS = new Set(['Pass', 'Fail', 'Blocked', 'Not Run']);
const ALLOWED_AUTO_STATUS = new Set(['Automated', 'Manual', 'In Progress', 'Not Automated']);
const ALLOWED_RUN_STATUS = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);
const ALLOWED_PLAN_STATUS = new Set(['Draft', 'Active', 'Completed']);
const ALLOWED_DEFECT_STATUS = new Set([
  'New',
  'Assigned',
  'In Progress',
  'Fixed',
  'Retest',
  'Reopened',
  'Closed',
]);
const ALLOWED_RELEASE_APPROVAL = new Set(['Pending', 'Approved', 'Rejected']);

function sanitizeId(raw: string, fallback = 'doc'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || fallback;
}

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : val == null ? fallback : String(val);
  return s.slice(0, maxLen);
}

function clampInt(val: unknown, maxVal = 1_000_000): number {
  const n = Math.floor(Number(val) || 0);
  return Math.max(0, Math.min(maxVal, n));
}

function clampStringList(list: unknown, maxItems: number, maxItemLen = 128): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, maxItems)
    .map((item) => clampStr(item, maxItemLen))
    .filter((item) => item.length > 0);
}

function assertVerifiedFirebaseUid(): string {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('Verified Firebase authentication is required for Cloud Firestore sync.');
  }
  return user.uid;
}

export interface FirestoreCollectionSummary {
  projects: number;
  testCases: number;
  runs: number;
  sqaPlans: number;
  sqaSuites: number;
  sqaDefects: number;
  sqaRequirements: number;
  sqaReleases: number;
  lastUpdatedAt: string;
}

export async function syncUserProfileToFirestore(profile: UserProfile): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const publicPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;
  const normalizedRole = ALLOWED_ROLES.has(profile.role) ? profile.role : 'sqa_engineer';

  try {
    const publicRef = doc(db, 'users', uid);
    const publicSnap = await getDoc(publicRef);
    if (!publicSnap.exists()) {
      await setDoc(publicRef, {
        uid,
        name: clampStr(profile.name || 'QA Engineer', 120, 'QA Engineer') || 'QA Engineer',
        role: normalizedRole,
        jobTitle: clampStr(profile.jobTitle, 120),
        organization: clampStr(profile.organization, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(publicRef, {
        name: clampStr(profile.name || 'QA Engineer', 120, 'QA Engineer') || 'QA Engineer',
        jobTitle: clampStr(profile.jobTitle, 120),
        organization: clampStr(profile.organization, 120),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const privateRef = doc(db, 'users', uid, 'private', 'info');
    const privateSnap = await getDoc(privateRef);
    const fbEmail = clampStr(auth.currentUser?.email || profile.email, 160);
    if (!privateSnap.exists()) {
      await setDoc(privateRef, {
        uid,
        email: fbEmail,
        emailVerified: Boolean(auth.currentUser?.emailVerified),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email: fbEmail,
        emailVerified: Boolean(auth.currentUser?.emailVerified),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function upsertProjectToFirestore(project: AutomationProject): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(project.id);
  const docPath = `projects/${projectId}`;

  const metadataFields = {
    name: clampStr(project.name, 120, 'Automation Project') || 'Automation Project',
    description: clampStr(project.description, 400),
    url: clampStr(project.url, 500, 'https://example.com') || 'https://example.com',
    tool: clampStr(project.tool, 32, 'playwright') || 'playwright',
    language: clampStr(project.language, 32, 'typescript') || 'typescript',
    framework: clampStr(project.framework, 48, 'playwright-ts') || 'playwright-ts',
    selectedFrameworks: clampStringList(
      project.selectedFrameworks?.length ? project.selectedFrameworks : [project.framework],
      12,
      48
    ),
    approach: clampStr(project.approach, 32, 'pom') || 'pom',
    testCaseCount: clampInt(project.testCases?.length || 0),
    fileCount: clampInt(project.files?.length || 0),
    inspectedPagesCount: clampInt(project.analysis?.pages?.length || 0),
    discoveredUrlsCount: clampInt(
      project.analysis?.discoveredUrls?.length || project.analysis?.pages?.length || 0
    ),
    coverageScope: clampStr(project.analysis?.coverageScope || 'single-page', 40),
  };

  try {
    const ref = doc(db, 'projects', projectId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: projectId,
        ownerUid: uid,
        ...metadataFields,
        googleSheetId: clampStr(project.googleSheetId, 200),
        googleSheetUrl: clampStr(project.googleSheetUrl, 500),
        googleSheetTitle: clampStr(project.googleSheetTitle, 200),
        googleSheetLastSync: clampStr(project.googleSheetLastSync, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...metadataFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function syncProjectSheetMetaToFirestore(
  projectIdRaw: string,
  meta: {
    googleSheetId?: string;
    googleSheetUrl?: string;
    googleSheetTitle?: string;
    googleSheetLastSync?: string;
  }
): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const docPath = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      googleSheetId: clampStr(meta.googleSheetId, 200),
      googleSheetUrl: clampStr(meta.googleSheetUrl, 500),
      googleSheetTitle: clampStr(meta.googleSheetTitle, 200),
      googleSheetLastSync: clampStr(meta.googleSheetLastSync, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteProjectFromFirestore(projectIdRaw: string): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const docPath = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function upsertTestCasesToFirestore(
  projectIdRaw: string,
  testCases: TestCase[]
): Promise<number> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(projectIdRaw);
  const listPath = `projects/${projectId}/testCases`;
  const bounded = testCases.slice(0, 200);
  if (bounded.length === 0) return 0;

  try {
    const existingSnap = await getDocs(
      query(collection(db, 'projects', projectId, 'testCases'), where('ownerUid', '==', uid))
    );
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const batch = writeBatch(db);
    let count = 0;
    for (const tc of bounded) {
      const tcId = sanitizeId(tc.id);
      const ref = doc(db, 'projects', projectId, 'testCases', tcId);
      const mutable = {
        module: clampStr(tc.module || 'Core', 120),
        title: clampStr(tc.title, 200, 'Test Case') || 'Test Case',
        scenario: clampStr(tc.scenario, 1000),
        preconditions: clampStr(tc.preconditions, 500),
        testData: clampStr(tc.testData, 500),
        expectedResult: clampStr(tc.expectedResult, 1000),
        actualResult: clampStr(tc.actualResult, 1000),
        comments: clampStr(tc.comments, 1000),
        category: clampStr(tc.category || 'functional', 40) || 'functional',
        testingType: clampStr(tc.testingType || 'Automated', 40) || 'Automated',
        priority: tc.priority && ALLOWED_PRIORITIES.has(tc.priority) ? tc.priority : 'Medium',
        severity: tc.severity && ALLOWED_SEVERITIES.has(tc.severity) ? tc.severity : 'Major',
        status: ALLOWED_TC_STATUS.has(tc.status) ? tc.status : 'pending',
        sqaStatus: tc.sqaStatus && ALLOWED_SQA_STATUS.has(tc.sqaStatus) ? tc.sqaStatus : 'Not Run',
        automationStatus:
          tc.automationStatus && ALLOWED_AUTO_STATUS.has(tc.automationStatus)
            ? tc.automationStatus
            : 'Automated',
        pagePath: clampStr(tc.pagePath, 300),
        enabled: Boolean(tc.enabled ?? true),
      };

      if (!existingIds.has(tcId)) {
        batch.set(ref, {
          id: tcId,
          projectId,
          ownerUid: uid,
          code: clampStr(tc.code || 'TC-001', 40) || 'TC-001',
          ...mutable,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(ref, {
          ...mutable,
          updatedAt: serverTimestamp(),
        });
      }
      count++;
    }
    await batch.commit();
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, listPath);
  }
}

export async function upsertTestRunToFirestore(run: TestRunRecord): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(run.projectId);
  const runId = sanitizeId(run.id);
  const docPath = `projects/${projectId}/runs/${runId}`;

  try {
    const ref = doc(db, 'projects', projectId, 'runs', runId);
    const snap = await getDoc(ref);
    const status = ALLOWED_RUN_STATUS.has(run.status) ? run.status : 'queued';
    if (!snap.exists()) {
      await setDoc(ref, {
        id: runId,
        projectId,
        ownerUid: uid,
        projectName: clampStr(run.projectName, 120, 'Run') || 'Run',
        browser: clampStr(run.browser, 32, 'chromium') || 'chromium',
        viewport: clampStr(run.viewport, 32, 'desktop') || 'desktop',
        headless: Boolean(run.headless),
        status,
        totalTests: clampInt(run.totalTests, 100_000),
        passed: clampInt(run.passed, 100_000),
        failed: clampInt(run.failed, 100_000),
        skipped: clampInt(run.skipped, 100_000),
        durationMs: clampInt(run.durationMs, 86_400_000),
        startedAt: clampStr(run.startedAt || new Date().toISOString(), 64),
        completedAt: clampStr(run.completedAt, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingStatus = snap.data()?.status;
      if (existingStatus === 'queued' || existingStatus === 'running') {
        await updateDoc(ref, {
          status,
          totalTests: clampInt(run.totalTests, 100_000),
          passed: clampInt(run.passed, 100_000),
          failed: clampInt(run.failed, 100_000),
          skipped: clampInt(run.skipped, 100_000),
          durationMs: clampInt(run.durationMs, 86_400_000),
          completedAt: clampStr(run.completedAt, 64),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function upsertSqaPlanToFirestore(plan: SqaTestPlan): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(plan.projectId);
  const planId = sanitizeId(plan.id);
  const docPath = `projects/${projectId}/sqaPlans/${planId}`;
  const mutable = {
    title: clampStr(plan.title, 160, 'Test Plan') || 'Test Plan',
    strategy: clampStr(plan.strategy, 2000),
    scope: clampStr(plan.scope, 2000),
    objectives: clampStr(plan.objectives, 2000),
    resources: clampStr(plan.resources, 1000),
    scheduleStart: clampStr(plan.scheduleStart, 40),
    scheduleEnd: clampStr(plan.scheduleEnd, 40),
    releaseTarget: clampStr(plan.releaseTarget, 80),
    status: ALLOWED_PLAN_STATUS.has(plan.status) ? plan.status : 'Draft',
  };

  try {
    const ref = doc(db, 'projects', projectId, 'sqaPlans', planId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: planId,
        projectId,
        ownerUid: uid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.status !== 'Completed') {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteSqaPlanFromFirestore(
  projectIdRaw: string,
  planIdRaw: string
): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const planId = sanitizeId(planIdRaw);
  const docPath = `projects/${projectId}/sqaPlans/${planId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'sqaPlans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function upsertSqaSuiteToFirestore(suite: SqaTestSuite): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(suite.projectId);
  const suiteId = sanitizeId(suite.id);
  const docPath = `projects/${projectId}/sqaSuites/${suiteId}`;
  const mutable = {
    name: clampStr(suite.name, 140, 'Test Suite') || 'Test Suite',
    suiteType: clampStr(suite.suiteType || 'Regression', 40) || 'Regression',
    description: clampStr(suite.description, 1000),
    testCaseIds: clampStringList(suite.testCaseIds, 200, 128),
  };

  try {
    const ref = doc(db, 'projects', projectId, 'sqaSuites', suiteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: suiteId,
        projectId,
        ownerUid: uid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteSqaSuiteFromFirestore(
  projectIdRaw: string,
  suiteIdRaw: string
): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const suiteId = sanitizeId(suiteIdRaw);
  const docPath = `projects/${projectId}/sqaSuites/${suiteId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'sqaSuites', suiteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function upsertSqaDefectToFirestore(defect: SqaDefect): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(defect.projectId);
  const defectId = sanitizeId(defect.id);
  const docPath = `projects/${projectId}/sqaDefects/${defectId}`;
  const status = ALLOWED_DEFECT_STATUS.has(defect.status) ? defect.status : 'New';

  try {
    const ref = doc(db, 'projects', projectId, 'sqaDefects', defectId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: defectId,
        bugCode: clampStr(defect.bugCode || 'BUG-001', 24) || 'BUG-001',
        projectId,
        ownerUid: uid,
        title: clampStr(defect.title, 200, 'Defect') || 'Defect',
        description: clampStr(defect.description, 2000),
        stepsToReproduce: clampStr(defect.stepsToReproduce, 2000),
        expectedResult: clampStr(defect.expectedResult, 1000),
        actualResult: clampStr(defect.actualResult, 1000),
        severity: clampStr(defect.severity || 'Major', 24) || 'Major',
        priority: clampStr(defect.priority || 'High', 24) || 'High',
        assignedDeveloper: clampStr(defect.assignedDeveloper, 120),
        reportedBy: clampStr(defect.reportedBy, 120),
        status,
        linkedTestCaseId: clampStr(defect.linkedTestCaseId, 128),
        linkedRequirementId: clampStr(defect.linkedRequirementId, 128),
        resolutionNotes: clampStr(defect.resolutionNotes, 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.status !== 'Closed') {
      await updateDoc(ref, {
        status,
        assignedDeveloper: clampStr(defect.assignedDeveloper, 120),
        severity: clampStr(defect.severity || 'Major', 24) || 'Major',
        priority: clampStr(defect.priority || 'High', 24) || 'High',
        resolutionNotes: clampStr(defect.resolutionNotes, 1000),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteSqaDefectFromFirestore(
  projectIdRaw: string,
  defectIdRaw: string
): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const defectId = sanitizeId(defectIdRaw);
  const docPath = `projects/${projectId}/sqaDefects/${defectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'sqaDefects', defectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function upsertSqaRequirementToFirestore(reqItem: SqaRequirement): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(reqItem.projectId);
  const reqId = sanitizeId(reqItem.id);
  const docPath = `projects/${projectId}/sqaRequirements/${reqId}`;
  const mutable = {
    type: reqItem.type === 'Business' ? 'Business' : 'Functional',
    title: clampStr(reqItem.title, 200, 'Requirement') || 'Requirement',
    description: clampStr(reqItem.description, 2000),
    module: clampStr(reqItem.module || 'Core', 120) || 'Core',
    priority: clampStr(reqItem.priority || 'High', 24) || 'High',
    linkedTestCaseIds: clampStringList(reqItem.linkedTestCaseIds, 100, 128),
    linkedDefectIds: clampStringList(reqItem.linkedDefectIds, 100, 128),
  };

  try {
    const ref = doc(db, 'projects', projectId, 'sqaRequirements', reqId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: reqId,
        reqCode: clampStr(reqItem.reqCode || 'REQ-001', 24) || 'REQ-001',
        projectId,
        ownerUid: uid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteSqaRequirementFromFirestore(
  projectIdRaw: string,
  reqIdRaw: string
): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const reqId = sanitizeId(reqIdRaw);
  const docPath = `projects/${projectId}/sqaRequirements/${reqId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'sqaRequirements', reqId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function upsertSqaReleaseToFirestore(rel: SqaRelease): Promise<void> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectId = sanitizeId(rel.projectId);
  const releaseId = sanitizeId(rel.id);
  const docPath = `projects/${projectId}/sqaReleases/${releaseId}`;
  const mutable = {
    version: clampStr(rel.version || 'v1.0.0', 40) || 'v1.0.0',
    name: clampStr(rel.name || 'Release', 140) || 'Release',
    buildNumber: clampStr(rel.buildNumber, 60),
    environment: clampStr(rel.environment || 'staging', 32) || 'staging',
    targetDate: clampStr(rel.targetDate, 40),
    buildVerified: Boolean(rel.buildVerified),
    readinessStatus: clampStr(rel.readinessStatus || 'Pending', 24) || 'Pending',
    approvalStatus: ALLOWED_RELEASE_APPROVAL.has(rel.approvalStatus)
      ? rel.approvalStatus
      : 'Pending',
    approvedBy: clampStr(rel.approvedBy, 120),
    notes: clampStr(rel.notes, 2000),
  };

  try {
    const ref = doc(db, 'projects', projectId, 'sqaReleases', releaseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: releaseId,
        projectId,
        ownerUid: uid,
        ...mutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.approvalStatus === 'Pending') {
      await updateDoc(ref, { ...mutable, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteSqaReleaseFromFirestore(
  projectIdRaw: string,
  releaseIdRaw: string
): Promise<void> {
  assertVerifiedFirebaseUid();
  const projectId = sanitizeId(projectIdRaw);
  const releaseId = sanitizeId(releaseIdRaw);
  const docPath = `projects/${projectId}/sqaReleases/${releaseId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'sqaReleases', releaseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function syncFullWorkspaceToFirestore(params: {
  user: UserProfile;
  projects: AutomationProject[];
  runs: TestRunRecord[];
  plans: SqaTestPlan[];
  suites: SqaTestSuite[];
  defects: SqaDefect[];
  requirements: SqaRequirement[];
  releases: SqaRelease[];
}): Promise<FirestoreCollectionSummary> {
  await syncUserProfileToFirestore(params.user);

  let tcCount = 0;
  for (const project of params.projects) {
    await upsertProjectToFirestore(project);
    tcCount += await upsertTestCasesToFirestore(project.id, project.testCases || []);
  }

  for (const run of params.runs) {
    await upsertTestRunToFirestore(run);
  }
  for (const plan of params.plans) {
    await upsertSqaPlanToFirestore(plan);
  }
  for (const suite of params.suites) {
    await upsertSqaSuiteToFirestore(suite);
  }
  for (const defect of params.defects) {
    await upsertSqaDefectToFirestore(defect);
  }
  for (const reqItem of params.requirements) {
    await upsertSqaRequirementToFirestore(reqItem);
  }
  for (const rel of params.releases) {
    await upsertSqaReleaseToFirestore(rel);
  }

  return {
    projects: params.projects.length,
    testCases: tcCount,
    runs: params.runs.length,
    sqaPlans: params.plans.length,
    sqaSuites: params.suites.length,
    sqaDefects: params.defects.length,
    sqaRequirements: params.requirements.length,
    sqaReleases: params.releases.length,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export async function fetchFirestoreCollectionSummary(): Promise<FirestoreCollectionSummary> {
  const uid = sanitizeId(assertVerifiedFirebaseUid());
  const projectsPath = 'projects';
  let projectDocs;
  try {
    projectDocs = await getDocs(
      query(collection(db, projectsPath), where('ownerUid', '==', uid))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, projectsPath);
  }

  let testCases = 0;
  let runs = 0;
  let sqaPlans = 0;
  let sqaSuites = 0;
  let sqaDefects = 0;
  let sqaRequirements = 0;
  let sqaReleases = 0;

  for (const pDoc of projectDocs.docs) {
    const pid = pDoc.id;
    const subcollections: [string, (n: number) => void][] = [
      ['testCases', (n) => (testCases += n)],
      ['runs', (n) => (runs += n)],
      ['sqaPlans', (n) => (sqaPlans += n)],
      ['sqaSuites', (n) => (sqaSuites += n)],
      ['sqaDefects', (n) => (sqaDefects += n)],
      ['sqaRequirements', (n) => (sqaRequirements += n)],
      ['sqaReleases', (n) => (sqaReleases += n)],
    ];

    for (const [sub, addCount] of subcollections) {
      const subPath = `projects/${pid}/${sub}`;
      try {
        const snap = await getDocs(
          query(collection(db, 'projects', pid, sub), where('ownerUid', '==', uid))
        );
        addCount(snap.size);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, subPath);
      }
    }
  }

  return {
    projects: projectDocs.size,
    testCases,
    runs,
    sqaPlans,
    sqaSuites,
    sqaDefects,
    sqaRequirements,
    sqaReleases,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function subscribeToFirestoreProjectCount(
  onUpdate: (count: number) => void,
  onError?: (err: Error) => void
): () => void {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return () => {};
  }
  const uid = sanitizeId(user.uid);
  const path = 'projects';
  return onSnapshot(
    query(collection(db, path), where('ownerUid', '==', uid)),
    (snapshot) => {
      onUpdate(snapshot.size);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
