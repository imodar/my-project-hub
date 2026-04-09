/**
 * اختبارات مكتبة التشفير E2EE
 *
 * يتحقق من:
 * - توليد أزواج المفاتيح ECDH
 * - تشفير وفك تشفير الرسائل AES-256-GCM
 * - تغليف وفك تغليف مفتاح العائلة
 * - تصدير واستيراد المفتاح الخاص بـ passphrase
 */
import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  generateFamilyKey,
  encryptMessage,
  decryptMessage,
  wrapFamilyKey,
  unwrapFamilyKey,
  exportPrivateKeyWithPassphrase,
  importPrivateKeyFromBackup,
} from "@/lib/crypto";

describe("Crypto — توليد المفاتيح", () => {
  it("يولّد زوج مفاتيح ECDH P-256 صالح", async () => {
    const keyPair = await generateKeyPair();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey.type).toBe("public");
    expect(keyPair.privateKey.type).toBe("private");
  });

  it("يُصدّر ويستورد المفتاح العام بنجاح", async () => {
    const keyPair = await generateKeyPair();
    const exported = await exportPublicKey(keyPair.publicKey);
    expect(typeof exported).toBe("string");
    expect(exported.length).toBeGreaterThan(0);

    const imported = await importPublicKey(exported);
    expect(imported.type).toBe("public");
    expect(imported.algorithm.name).toBe("ECDH");
  });

  it("يولّد مفتاح AES-256-GCM للعائلة", async () => {
    const familyKey = await generateFamilyKey();
    expect(familyKey).toBeDefined();
    expect(familyKey.algorithm.name).toBe("AES-GCM");
    expect((familyKey.algorithm as AesKeyAlgorithm).length).toBe(256);
  });
});

describe("Crypto — تشفير الرسائل", () => {
  it("يشفر ويفك تشفير رسالة بنجاح", async () => {
    const key = await generateFamilyKey();
    const originalMessage = "مرحباً بك في منظم العائلة 🌟";

    const encrypted = await encryptMessage(key, originalMessage);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(originalMessage);

    const decrypted = await decryptMessage(key, encrypted);
    expect(decrypted).toBe(originalMessage);
  });

  it("ينتج ciphertext مختلف لكل تشفير (IV عشوائي)", async () => {
    const key = await generateFamilyKey();
    const message = "نفس الرسالة";

    const enc1 = await encryptMessage(key, message);
    const enc2 = await encryptMessage(key, message);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it("يفشل فك التشفير بمفتاح خاطئ", async () => {
    const key1 = await generateFamilyKey();
    const key2 = await generateFamilyKey();
    const message = "رسالة سرية";

    const encrypted = await encryptMessage(key1, message);

    await expect(decryptMessage(key2, encrypted)).rejects.toThrow();
  });

  it("يشفر رسائل طويلة ومحارف Unicode", async () => {
    const key = await generateFamilyKey();
    const longMessage = "أ".repeat(10_000) + " 🕌🌙⭐ " + "a".repeat(5_000);

    const encrypted = await encryptMessage(key, longMessage);
    const decrypted = await decryptMessage(key, encrypted);
    expect(decrypted).toBe(longMessage);
  });
});

describe("Crypto — تغليف مفتاح العائلة (ECDH)", () => {
  it("يُغلّف ويفك تغليف مفتاح العائلة بنجاح", async () => {
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();
    const familyKey = await generateFamilyKey();

    // Alice تُغلّف مفتاح العائلة لـ Bob
    const wrapped = await wrapFamilyKey(
      familyKey,
      aliceKeys.privateKey,
      bobKeys.publicKey
    );

    expect(wrapped.ciphertext).toBeDefined();
    expect(wrapped.iv).toBeDefined();

    // Bob يفك التغليف
    const unwrapped = await unwrapFamilyKey(
      wrapped,
      bobKeys.privateKey,
      aliceKeys.publicKey
    );

    expect(unwrapped).toBeDefined();

    // التحقق أن المفتاح المفكوك يُشفّر بنجاح
    const message = "رسالة اختبار";
    const encrypted = await encryptMessage(familyKey, message);
    const decrypted = await decryptMessage(unwrapped, encrypted);
    expect(decrypted).toBe(message);
  });

  it("يفشل فك التغليف بمفاتيح خاطئة", async () => {
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();
    const eveKeys = await generateKeyPair(); // مهاجم
    const familyKey = await generateFamilyKey();

    const wrapped = await wrapFamilyKey(
      familyKey,
      aliceKeys.privateKey,
      bobKeys.publicKey
    );

    // Eve تحاول فك التغليف بمفاتيحها — يجب أن يفشل
    await expect(
      unwrapFamilyKey(wrapped, eveKeys.privateKey, aliceKeys.publicKey)
    ).rejects.toThrow();
  });
});

describe("Crypto — Key Backup بـ Passphrase", () => {
  it("يُصدّر ويستورد المفتاح الخاص بكلمة مرور", async () => {
    const keyPair = await generateKeyPair();
    const passphrase = "كلمة-سر-قوية-1234!";

    const backup = await exportPrivateKeyWithPassphrase(
      keyPair.privateKey,
      passphrase
    );

    expect(backup.version).toBe(1);
    expect(backup.salt).toBeDefined();
    expect(backup.iv).toBeDefined();
    expect(backup.encrypted).toBeDefined();

    // الاستيراد بنفس كلمة المرور
    const restored = await importPrivateKeyFromBackup(backup, passphrase);
    expect(restored.type).toBe("private");
    expect(restored.algorithm.name).toBe("ECDH");
  });

  it("يفشل الاستيراد بكلمة مرور خاطئة", async () => {
    const keyPair = await generateKeyPair();
    const backup = await exportPrivateKeyWithPassphrase(
      keyPair.privateKey,
      "كلمة-المرور-الصحيحة"
    );

    await expect(
      importPrivateKeyFromBackup(backup, "كلمة-مرور-خاطئة")
    ).rejects.toThrow("كلمة المرور غير صحيحة أو الـ backup تالف");
  });

  it("ينتج backup مختلف لكل تصدير (salt عشوائي)", async () => {
    const keyPair = await generateKeyPair();
    const passphrase = "نفس-كلمة-المرور";

    const backup1 = await exportPrivateKeyWithPassphrase(keyPair.privateKey, passphrase);
    const backup2 = await exportPrivateKeyWithPassphrase(keyPair.privateKey, passphrase);

    expect(backup1.salt).not.toBe(backup2.salt);
    expect(backup1.iv).not.toBe(backup2.iv);
    expect(backup1.encrypted).not.toBe(backup2.encrypted);
  });

  it("المفتاح المُستعاد يُشفّر بنفس طريقة الأصل", async () => {
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();
    const familyKey = await generateFamilyKey();
    const passphrase = "test-passphrase-789";

    // تصدير مفتاح Alice الخاص واستعادته
    const backup = await exportPrivateKeyWithPassphrase(aliceKeys.privateKey, passphrase);
    const aliceRestoredPrivateKey = await importPrivateKeyFromBackup(backup, passphrase);

    // Alice تُغلّف مفتاح العائلة لـ Bob بمفتاحها المُستعاد
    const wrappedForBob = await wrapFamilyKey(
      familyKey,
      aliceRestoredPrivateKey,
      bobKeys.publicKey
    );

    // Bob يفك التغليف باستخدام مفتاح Alice العام الأصلي
    const unwrapped = await unwrapFamilyKey(
      wrappedForBob,
      bobKeys.privateKey,
      aliceKeys.publicKey // المفتاح العام لـ Alice
    );

    // التحقق أن مفتاح العائلة المُستعاد صحيح
    const message = "رسالة تحقق من المفتاح المُستعاد";
    const encrypted = await encryptMessage(familyKey, message);
    const decrypted = await decryptMessage(unwrapped, encrypted);
    expect(decrypted).toBe(message);
  });
});
