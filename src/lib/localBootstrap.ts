/**
 * Local Bootstrap — يقرأ حالة الجهاز من Dexie و localStorage
 * يُستخدم لتحديد هل التطبيق يقدر يفتح فوراً من البيانات المحلية
 */
import { db } from "./db";
import { getMeaningfulLocalDataState } from "./meaningfulLocalData";

export interface LocalBootstrapResult {
  hasLocalData: boolean;
  familyId: string | null;
  profileName: string | null;
  isEmptyDevice: boolean;
}

/** Scan localStorage for cached profile name */
function getCachedProfileName(): string | null {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith("profile_name_")) {
        const val = localStorage.getItem(k);
        if (val) return val;
      }
    }
  } catch {}
  return null;
}

export async function getLocalBootstrap(): Promise<LocalBootstrapResult> {
  // 1. localStorage — fastest
  const cachedFamilyId = localStorage.getItem("cached_family_id");
  const cachedName = getCachedProfileName();

  // 2. Dexie fallback
  let dexieProfile: any = null;
  let dexieMember: any = null;
  let hasLocalData = false;

  try {
    const [profile, member, meaningful] = await Promise.all([
      db.profiles.toCollection().first(),
      db.family_members.toCollection().first(),
      getMeaningfulLocalDataState(),
    ]);
    dexieProfile = profile;
    dexieMember = member;
    hasLocalData = meaningful.hasMeaningfulLocalData || !!member;
  } catch {
    // Dexie not available — rely on localStorage only
  }

  const familyId = cachedFamilyId || dexieMember?.family_id || null;
  const profileName = cachedName || dexieProfile?.name || null;

  return {
    hasLocalData: hasLocalData || !!cachedFamilyId,
    familyId,
    profileName,
    isEmptyDevice: !familyId && !hasLocalData,
  };
}
