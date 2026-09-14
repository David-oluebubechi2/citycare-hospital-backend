-- CityCare Hospital - PostgreSQL schema
-- Column names are camelCase and quoted to preserve exact case,
-- matching the Mongoose document fields used across the app.

CREATE TABLE IF NOT EXISTS users (
  "_id" SERIAL PRIMARY KEY,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL,
  "department" TEXT NOT NULL DEFAULT '',
  "specialization" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "avatar" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "dateOfBirth" TEXT NOT NULL DEFAULT '',
  "gender" TEXT NOT NULL DEFAULT 'Male',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  "_id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users("_id") ON DELETE CASCADE,
  "patientId" TEXT NOT NULL DEFAULT '',
  "bloodGroup" TEXT NOT NULL DEFAULT '',
  "genotype" TEXT NOT NULL DEFAULT '',
  "allergies" JSONB NOT NULL DEFAULT '[]',
  "chronicConditions" JSONB NOT NULL DEFAULT '[]',
  "emergencyContactName" TEXT NOT NULL DEFAULT '',
  "emergencyContactPhone" TEXT NOT NULL DEFAULT '',
  "emergencyContactRelation" TEXT NOT NULL DEFAULT '',
  "insuranceProvider" TEXT NOT NULL DEFAULT '',
  "insuranceNumber" TEXT NOT NULL DEFAULT '',
  "height" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "occupation" TEXT NOT NULL DEFAULT '',
  "patientType" TEXT NOT NULL DEFAULT 'New',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  "_id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users("_id") ON DELETE CASCADE,
  "doctorId" TEXT NOT NULL DEFAULT '',
  "specialization" TEXT NOT NULL DEFAULT '',
  "department" TEXT NOT NULL DEFAULT '',
  "yearsOfExperience" INTEGER NOT NULL DEFAULT 0,
  "education" TEXT NOT NULL DEFAULT '',
  "bio" TEXT NOT NULL DEFAULT '',
  "schedule" JSONB NOT NULL DEFAULT '[]',
  "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 5000,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "totalPatients" INTEGER NOT NULL DEFAULT 0,
  "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalRatings" INTEGER NOT NULL DEFAULT 0,
  "languages" JSONB NOT NULL DEFAULT '["English"]',
  "licenseNumber" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  "_id" SERIAL PRIMARY KEY,
  "patientId" INTEGER NOT NULL REFERENCES patients("_id"),
  "doctorId" INTEGER NOT NULL REFERENCES doctors("_id"),
  "createdBy" INTEGER NULL REFERENCES users("_id"),
  "appointmentDate" TEXT NOT NULL DEFAULT '',
  "appointmentTime" TEXT NOT NULL DEFAULT '',
  "reason" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'Scheduled',
  "type" TEXT NOT NULL DEFAULT 'General Consultation',
  "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
  "department" TEXT NOT NULL DEFAULT '',
  "cancelReason" TEXT NOT NULL DEFAULT '',
  "reminderSent" BOOLEAN NOT NULL DEFAULT false,
  "followUpDate" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medicines (
  "_id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT '',
  "genericName" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '',
  "manufacturer" TEXT NOT NULL DEFAULT '',
  "dosage" TEXT NOT NULL DEFAULT '',
  "form" TEXT NOT NULL DEFAULT '',
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reorderLevel" INTEGER NOT NULL DEFAULT 10,
  "expiryDate" TEXT NOT NULL DEFAULT '',
  "batchNumber" TEXT NOT NULL DEFAULT '',
  "inStock" BOOLEAN NOT NULL DEFAULT true,
  "sideEffects" TEXT NOT NULL DEFAULT '',
  "contraindications" TEXT NOT NULL DEFAULT '',
  "storageConditions" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'Naira',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  "_id" SERIAL PRIMARY KEY,
  "patientId" INTEGER NOT NULL REFERENCES patients("_id"),
  "doctorId" INTEGER NOT NULL REFERENCES doctors("_id"),
  "appointmentId" INTEGER NULL REFERENCES appointments("_id"),
  "items" JSONB NOT NULL DEFAULT '[]',
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "notes" TEXT NOT NULL DEFAULT '',
  "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labtests (
  "_id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "normalRange" TEXT NOT NULL DEFAULT '',
  "unit" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sampleType" TEXT NOT NULL DEFAULT '',
  "turnaroundTime" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labresults (
  "_id" SERIAL PRIMARY KEY,
  "patientId" INTEGER NOT NULL REFERENCES patients("_id"),
  "requestedBy" INTEGER NULL REFERENCES users("_id"),
  "completedBy" INTEGER NULL REFERENCES users("_id"),
  "appointmentId" INTEGER NULL REFERENCES appointments("_id"),
  "tests" JSONB NOT NULL DEFAULT '[]',
  "results" JSONB NOT NULL DEFAULT '[]',
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Requested',
  "notes" TEXT NOT NULL DEFAULT '',
  "diagnosis" TEXT NOT NULL DEFAULT '',
  "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
  "completedAt" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  "_id" SERIAL PRIMARY KEY,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  "patientId" INTEGER NOT NULL REFERENCES patients("_id"),
  "appointmentId" INTEGER NULL REFERENCES appointments("_id"),
  "items" JSONB NOT NULL DEFAULT '[]',
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "paymentMethod" TEXT NOT NULL DEFAULT 'Pending',
  "paidAt" TEXT NOT NULL DEFAULT '',
  "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountRemaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "isInsuranceClaim" BOOLEAN NOT NULL DEFAULT false,
  "insuranceProvider" TEXT NOT NULL DEFAULT '',
  "insuranceCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  "_id" SERIAL PRIMARY KEY,
  "senderId" INTEGER NOT NULL REFERENCES users("_id"),
  "recipientId" INTEGER NOT NULL REFERENCES users("_id"),
  "content" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'text',
  "read" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TEXT NOT NULL DEFAULT '',
  "channel" TEXT NOT NULL DEFAULT '',
  "participants" JSONB NOT NULL DEFAULT '[]',
  "roomId" TEXT NOT NULL DEFAULT '',
  "isGroupMessage" BOOLEAN NOT NULL DEFAULT false,
  "groupName" TEXT NOT NULL DEFAULT '',
  "attachments" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diagnoses (
  "_id" SERIAL PRIMARY KEY,
  "patientId" INTEGER NOT NULL REFERENCES users("_id"),
  "doctorId" INTEGER NOT NULL REFERENCES users("_id"),
  "diagnosis" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "date" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patientnotes (
  "_id" SERIAL PRIMARY KEY,
  "patientId" INTEGER NOT NULL REFERENCES users("_id"),
  "doctorId" INTEGER NOT NULL REFERENCES users("_id"),
  "note" TEXT NOT NULL DEFAULT '',
  "date" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT 'general',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  "_id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users("_id"),
  "title" TEXT NOT NULL DEFAULT '',
  "message" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'info',
  "read" BOOLEAN NOT NULL DEFAULT false,
  "link" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  "_id" SERIAL PRIMARY KEY,
  "doctorId" INTEGER NOT NULL REFERENCES users("_id"),
  "name" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT '',
  "date" TEXT NOT NULL DEFAULT '',
  "fileUrl" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_user ON patients("userId");
CREATE INDEX IF NOT EXISTS idx_doctors_user ON doctors("userId");
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments("patientId");
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments("doctorId");
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions("patientId");
CREATE INDEX IF NOT EXISTS idx_labresults_patient ON labresults("patientId");
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices("patientId");
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderId");
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages("recipientId");
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId");