/**
 * Set a password on a local development account.
 *
 * Exists so the running application can be signed into by hand, which is what
 * the interactive half of an audit needs — navigation, buttons, workflows,
 * responsive checks. The seeded fixtures carry whatever password the seed set,
 * which nobody remembers, and that was enough to stall a whole audit.
 *
 * The password is read from a prompt, never from an argument. Passing it on the
 * command line would put it in shell history and in the process list, and would
 * mean whoever wrote the command had chosen it. Here the person running it types
 * it, and it goes straight to the hasher.
 *
 * Hashed by better-auth's own hashPassword rather than a reimplementation, so
 * the stored format is by definition the one the app verifies against — there is
 * no scrypt parameter to get subtly wrong.
 *
 * Refuses to run against anything but a local SQLite file. Setting a password
 * without knowing the old one is exactly what must never be possible against a
 * real database.
 *
 *   node scripts/dev-set-password.mjs admin@techfix.ug
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { createInterface } from "node:readline";

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error("[dev-set-password] refusing to run: DATABASE_URL is not a local file: URL.");
  console.error("[dev-set-password] this sets a password without knowing the old one and must never touch a real database.");
  process.exit(1);
}
if (process.env.TURSO_DATABASE_URL) {
  console.error("[dev-set-password] refusing to run: TURSO_DATABASE_URL is set.");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/dev-set-password.mjs <email>");
  process.exit(1);
}
if (process.argv[3]) {
  console.error("[dev-set-password] refusing: pass only the email. The password is typed at the prompt,");
  console.error("[dev-set-password] so it stays out of your shell history and the process list.");
  process.exit(1);
}

/** Read a line without echoing it back to the terminal. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      // Redraw the prompt without the typed characters.
      if (![`\n`, `\r`, ``].includes(char.toString())) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(question);
      }
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, name: true, role: true, orgId: true, isActive: true },
  });
  if (!user) {
    console.error(`[dev-set-password] no user with email ${email} in this local database.`);
    process.exit(1);
  }

  console.log(`Setting a password for ${user.name ?? user.email} (${user.role}).`);
  const password = await askHidden("New password: ");
  if (password.length < 8) {
    console.error("[dev-set-password] too short — the app requires at least 8 characters.");
    process.exit(1);
  }
  const again = await askHidden("Again: ");
  if (password !== again) {
    console.error("[dev-set-password] the two did not match; nothing was changed.");
    process.exit(1);
  }

  const hash = await hashPassword(password);

  // BetterAuth keeps credentials on Account rows, not on User, and the
  // credential provider is the one with providerId "credential".
  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });
  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { password: hash } });
  } else {
    await prisma.account.create({
      data: {
        // id is left to Prisma's own cuid default, which is what every existing
        // row carries — supplying a uuid here would make this one look foreign.
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Existing sessions keep working; this only changes what a new sign-in needs.
  console.log("");
  console.log(`Done. Sign in at http://localhost:3000/login as ${user.email}.`);
} finally {
  await prisma.$disconnect();
}
