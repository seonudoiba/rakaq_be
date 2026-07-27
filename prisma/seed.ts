import 'dotenv/config';
import { PrismaClient, UserRole, TankStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ============= REGIONS =============
  const regionData = [
    { name: 'Lagos', code: 'LAG', description: 'Lagos State Region' },
    { name: 'Abuja', code: 'ABJ', description: 'Federal Capital Territory' },
    { name: 'Port Harcourt', code: 'PHC', description: 'Rivers State Region' },
    { name: 'Kano', code: 'KAN', description: 'Kano State Region' },
  ];

  console.log('📌 Creating regions...');
  for (const data of regionData) {
    await prisma.region.upsert({
      where: { code: data.code },
      update: data,
      create: data,
    });
  }
  console.log('✅ Regions created');

  // ============= STATIONS =============
  const stationData = [
    {
      name: 'Station Alpha',
      code: 'ALPHA-01',
      address: '122 Ikorodu Road, Maryland',
      city: 'Lagos',
      state: 'Lagos',
      regionCode: 'LAG',
    },
    {
      name: 'Station Beta',
      code: 'BETA-02',
      address: 'Plot 442 Gwarinpa Estate',
      city: 'Abuja',
      state: 'FCT',
      regionCode: 'ABJ',
    },
    {
      name: 'Main Depot PH',
      code: 'DEPOT-PH',
      address: 'Industrial Layout, Trans Amadi',
      city: 'Port Harcourt',
      state: 'Rivers',
      regionCode: 'PHC',
    },
  ];

  console.log('📌 Creating stations...');
  for (const data of stationData) {
    const region = await prisma.region.findUnique({
      where: { code: data.regionCode },
    });
    if (!region) {
      console.warn(`⚠️ Region ${data.regionCode} not found, skipping station ${data.code}`);
      continue;
    }
    await prisma.station.upsert({
      where: { code: data.code },
      update: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        regionId: region.id,
      },
      create: {
        name: data.name,
        code: data.code,
        address: data.address,
        city: data.city,
        state: data.state,
        regionId: region.id,
      },
    });
  }
  console.log('✅ Stations created');

  // ============= USERS =============
  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const userData = [
    // Super Admin
    {
      email: 'admin@rekaz.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+2348000000001',
      role: UserRole.SUPER_ADMIN,
      regionCode: null,
      stationCode: null,
    },
    // Regional Managers (now also handles depot responsibilities)
    {
      email: 'manager.lagos@rekaz.com',
      password: hashedPassword,
      firstName: 'Chidi',
      lastName: 'Obi',
      phone: '+2348000000002',
      role: UserRole.REGIONAL_MANAGER,
      regionCode: 'LAG',
      stationCode: null,
    },
    {
      email: 'manager.abuja@rekaz.com',
      password: hashedPassword,
      firstName: 'Amina',
      lastName: 'Bello',
      phone: '+2348000000003',
      role: UserRole.REGIONAL_MANAGER,
      regionCode: 'ABJ',
      stationCode: null,
    },
    // Supervisors (changed from Station Manager)
    {
      email: 'supervisor.alpha@rekaz.com',
      password: hashedPassword,
      firstName: 'Chidi',
      lastName: 'Azikiwe',
      phone: '+2348000000004',
      role: UserRole.SUPERVISOR,
      regionCode: null,
      stationCode: 'ALPHA-01',
    },
    // Attendant
    {
      email: 'attendant1@rekaz.com',
      password: hashedPassword,
      firstName: 'Ade',
      lastName: 'Opeyemi',
      phone: '+2348000000005',
      role: UserRole.ATTENDANT,
      regionCode: null,
      stationCode: 'ALPHA-01',
    },
    // Accountant
    {
      email: 'accountant@rekaz.com',
      password: hashedPassword,
      firstName: 'Bisi',
      lastName: 'Adebayo',
      phone: '+2348000000007',
      role: UserRole.ACCOUNTANT,
      regionCode: null,
      stationCode: null,
    },
  ];

  console.log('📌 Creating users...');
  for (const data of userData) {
    let regionId = undefined;
    let stationId = undefined;

    if (data.regionCode) {
      const region = await prisma.region.findUnique({
        where: { code: data.regionCode },
      });
      if (region) regionId = region.id;
    }

    if (data.stationCode) {
      const station = await prisma.station.findUnique({
        where: { code: data.stationCode },
      });
      if (station) stationId = station.id;
    }

    await prisma.user.upsert({
      where: { email: data.email },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        regionId,
        stationId,
        isActive: true,
      },
      create: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        regionId,
        stationId,
        isActive: true,
      },
    });
  }
  console.log('✅ Users created');

  // ============= TANKS =============
  const stationAlpha = await prisma.station.findUnique({
    where: { code: 'ALPHA-01' },
  });

  if (stationAlpha) {
    console.log('📌 Creating tanks...');
    
    const existingTanks = await prisma.tank.findMany({
      where: { stationId: stationAlpha.id },
    });

    if (existingTanks.length === 0) {
      await prisma.tank.createMany({
        data: [
          {
            stationId: stationAlpha.id,
            name: 'PMS Tank 1',
            productType: 'PMS',
            capacity: 32400,
            currentLevel: 23328,
            percentage: 72,
            status: TankStatus.NORMAL,
          },
          {
            stationId: stationAlpha.id,
            name: 'PMS Tank 2',
            productType: 'PMS',
            capacity: 24750,
            currentLevel: 13612.5,
            percentage: 55,
            status: TankStatus.NORMAL,
          },
          {
            stationId: stationAlpha.id,
            name: 'AGO Tank',
            productType: 'AGO',
            capacity: 4900,
            currentLevel: 686,
            percentage: 14,
            status: TankStatus.CRITICAL,
          },
        ],
      });
      console.log('✅ Tanks created');
    } else {
      console.log('ℹ️ Tanks already exist, skipping...');
    }
  }

  // ============= PUMPS =============
  if (stationAlpha) {
    console.log('📌 Creating pumps...');
    
    const existingPumps = await prisma.pump.findMany({
      where: { stationId: stationAlpha.id },
    });

    if (existingPumps.length === 0) {
      await prisma.pump.createMany({
        data: [
          {
            stationId: stationAlpha.id,
            pumpNumber: 1,
            productType: 'PMS',
            openingMeter: 1245000,
            closingMeter: 1248500,
            isActive: true,
          },
          {
            stationId: stationAlpha.id,
            pumpNumber: 2,
            productType: 'PMS',
            openingMeter: 892100,
            closingMeter: 894850,
            isActive: true,
          },
          {
            stationId: stationAlpha.id,
            pumpNumber: 3,
            productType: 'AGO',
            openingMeter: 456320,
            closingMeter: 457120,
            isActive: true,
          },
        ],
      });
      console.log('✅ Pumps created');
    } else {
      console.log('ℹ️ Pumps already exist, skipping...');
    }
  }

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });