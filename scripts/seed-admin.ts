import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../src/lib/db/schema/users';
import { creatures, DEFAULT_ELEMENT_LEVELS, DEFAULT_TRAIT_VALUES } from '../src/lib/db/schema/creatures';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/mutagenix';

async function seed() {
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const adminEmail = 'luca.cozza@gmail.com';
  const adminDisplayName = 'Luca';
  const adminPassword = 'Mutagenix2026!';

  console.log('Seeding admin user...');

  // Check if admin already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing) {
    console.log('Admin user already exists, skipping.');
    await client.end();
    return;
  }

  const passwordHash = await hash(adminPassword, 12);

  const [adminUser] = await db
    .insert(users)
    .values({
      email: adminEmail,
      displayName: adminDisplayName,
      passwordHash,
      isAdmin: true,
    })
    .returning({ id: users.id, email: users.email, displayName: users.displayName });

  console.log(`Created admin user: ${adminUser.email} (${adminUser.id})`);

  const [creature] = await db
    .insert(creatures)
    .values({
      userId: adminUser.id,
      name: 'Specimen-001',
      elementLevels: DEFAULT_ELEMENT_LEVELS,
      traitValues: DEFAULT_TRAIT_VALUES,
      visualParams: {},
    })
    .returning({ id: creatures.id, name: creatures.name });

  console.log(`Created creature: ${creature.name} (${creature.id})`);

  await client.end();
  console.log('Seed complete.');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
