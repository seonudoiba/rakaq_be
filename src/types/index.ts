// ============= ENUMS =============
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  REGIONAL_MANAGER = 'REGIONAL_MANAGER',
  SUPERVISOR = 'SUPERVISOR',  // Changed from SUPERVISOR
  ATTENDANT = 'ATTENDANT',
  ACCOUNTANT = 'ACCOUNTANT',
  // DEPOT_MANAGER removed
}

export enum PaymentMethod {
  CASH = 'CASH',
  POS = 'POS',
  TRANSFER = 'TRANSFER',
  CREDIT = 'CREDIT',
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  stationId?: string;
  regionId?: string;
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum ExpenseCategory {
  FUEL_FOR_GENS = 'FUEL_FOR_GENS',
  MAINTENANCE = 'MAINTENANCE',
  SALARIES = 'SALARIES',
  UTILITIES = 'UTILITIES',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  OPERATIONAL = 'OPERATIONAL',
}

export enum TankStatus {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum SupportTicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum SupportTicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// ============= USER TYPES =============
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  stationId?: string;
  regionId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  station?: Station;
  region?: Region;
  settings?: Settings;
  employeeRecords?: Employee[];
}

export interface Region {
  id: string;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  users?: User[];
  stations?: Station[];
}

export interface Station {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  regionId: string;
  managerId?: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  openingTime?: string;
  closingTime?: string;
  createdAt: string;
  updatedAt: string;
  region: Region;
  manager?: User;
  tanks: Tank[];
  pumps: Pump[];
  sales?: Sale[];
  expenses?: Expense[];
  pumpReadings?: PumpReading[];
  inventoryLogs?: InventoryLog[];
  deliveries?: Delivery[];
}

// ============= INVENTORY TYPES =============
export interface Tank {
  id: string;
  stationId: string;
  productType: string;
  name: string;
  capacity: number;
  currentLevel: number;
  percentage: number;
  status: TankStatus;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  station: Station;
  inventoryLogs?: InventoryLog[];
}

export interface InventoryLog {
  id: string;
  stationId: string;
  tankId?: string;
  productType: string;
  previousLevel: number;
  newLevel: number;
  adjustment: number;
  reason: string;
  userId: string;
  createdAt: string;
  station: Station;
  tank?: Tank;
  user: User;
}

// ============= PUMP TYPES =============
export interface Pump {
  id: string;
  stationId: string;
  pumpNumber: number;
  productType: string;
  openingMeter: number;
  closingMeter: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  station: Station;
  readings?: PumpReading[];
  sales?: Sale[];
}

export interface PumpReading {
  id: string;
  pumpId: string;
  attendantId: string;
  stationId: string;
  openingMeter: number;
  closingMeter: number;
  litresSold: number;
  expectedRevenue: number;
  readingDate: string;
  createdAt: string;
  pump: Pump;
  attendant: User;
  station: Station;
}

// ============= SALES TYPES =============
export interface Sale {
  id: string;
  stationId: string;
  pumpId?: string;
  productType: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  customerName?: string;
  customerPhone?: string;
  attendantId: string;
  verifiedById?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  station: Station;
  pump?: Pump;
  attendant: User;
  verifiedBy?: User;
}

export interface DailyReport {
  date: string;
  totalSales: number;
  totalVolume: number;
  transactionCount: number;
  paymentBreakdown: {
    method: PaymentMethod;
    amount: number;
    count: number;
    percentage: number;
  }[];
  transactions: Sale[];
}

// ============= EXPENSES TYPES =============
export interface Expense {
  id: string;
  stationId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  voucherNumber: string;
  receiptUrl?: string;
  approvedById?: string;
  approvedAt?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  station: Station;
  approvedBy?: User;
  createdBy: User;
}

// ============= PURCHASES TYPES =============
export interface PurchaseOrder {
  id: string;
  supplierName: string;
  supplierId?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  productType: string;
  volume: number;
  unitCost: number;
  totalCost: number;
  expectedDelivery?: string;
  actualDelivery?: string;
  status: PurchaseOrderStatus;
  orderNumber: string;
  invoiceNumber?: string;
  paymentStatus: string;
  createdById: string;
  approvedById?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  approvedBy?: User;
  deliveries: Delivery[];
}

// ============= LOGISTICS TYPES =============
export interface Delivery {
  id: string;
  purchaseOrderId: string;
  stationId?: string;
  tankerId: string;
  volume: number;
  dispatchedAt: string;
  deliveredAt?: string;
  status: string;
  currentLocation?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  purchaseOrder: PurchaseOrder;
  station?: Station;
  locationLogs: DeliveryLocationLog[];
}

export interface DeliveryLocationLog {
  id: string;
  deliveryId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  notes?: string;
  delivery: Delivery;
}

// ============= EMPLOYEE TYPES =============
export interface Employee {
  id: string;
  userId: string;
  stationId: string;
  employeeId: string;
  position: string;
  department: string;
  hireDate: string;
  salary?: number;
  bankName?: string;
  accountNumber?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  station: Station;
}

// ============= SUPPORT TYPES =============
export interface SupportTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: string;
  createdById: string;
  assignedToId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  assignedTo?: User;
  comments: SupportTicketComment[];
}

export interface SupportTicketComment {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  ticket: SupportTicket;
  user: User;
}

// ============= SETTINGS TYPES =============
export interface Settings {
  id: string;
  userId: string;
  theme: string;
  language: string;
  notifications: Record<string, any>;
  preferences: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  user: User;
}

// ============= NOTIFICATION TYPES =============
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  user: User;
}

// ============= AUDIT TYPES =============
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user: User;
}

// ============= API RESPONSE TYPES =============
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  stationId?: string;
  regionId?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// ============= REPORT TYPES =============
export interface SalesReport {
  summary: {
    totalSales: number;
    totalVolume: number;
    transactionCount: number;
    averageTransactionValue: number;
  };
  paymentBreakdown: {
    method: PaymentMethod;
    _sum: { totalAmount: number };
    _count: number;
  }[];
  productBreakdown: {
    productType: string;
    productName: string;
    _sum: { quantity: number; totalAmount: number };
  }[];
  dailyBreakdown: any[];
  dateRange: { startDate: string; endDate: string };
}

export interface FinancialReport {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    profitMargin: number;
    transactionCount: number;
    expenseCount: number;
  };
  expensesByCategory: {
    category: ExpenseCategory;
    _sum: { amount: number };
  }[];
  dateRange: { startDate: string; endDate: string };
}

export interface InventoryReport {
  tanks: (Tank & { status: string })[];
  summary: {
    totalTanks: number;
    totalCapacity: number;
    totalCurrentLevel: number;
    averagePercentage: number;
    lowStockCount: number;
  };
  movement: {
    productType: string;
    reason: string;
    _sum: { adjustment: number };
  }[];
  lowStock: Tank[];
}

export interface StationReport {
  station: Station;
  performance: {
    totalSales: number;
    totalVolume: number;
    transactionCount: number;
    averageDailySales: number;
  };
  dailyTrend: any[];
  topProducts: {
    productType: string;
    productName: string;
    _sum: { quantity: number; totalAmount: number };
  }[];
  dateRange: { startDate: string; endDate: string };
}

// ============= ANALYTICS TYPES =============
export interface PerformanceMetrics {
  stationId: string;
  stationName: string;
  period: { startDate: string; endDate: string };
  metrics: {
    totalSales: number;
    totalVolume: number;
    transactionCount: number;
    averageTransactionValue: number;
    totalExpenses: number;
    profit: number;
    profitMargin: number;
    growthRate: number;
  };
  trends: {
    daily: any[];
    weekly: any[];
    monthly: any[];
  };
}

export interface TrendsAnalysis {
  metric: string;
  dataPoints: {
    date: string;
    value: number;
  }[];
  statistics: {
    mean: number;
    median: number;
    min: number;
    max: number;
    standardDeviation: number;
  };
  forecast: {
    date: string;
    value: number;
    confidenceLower: number;
    confidenceUpper: number;
  }[];
}

export interface StationComparison {
  stations: {
    id: string;
    name: string;
    value: number;
    rank: number;
  }[];
  metric: string;
  period: { startDate: string; endDate: string };
  statistics: {
    average: number;
    max: number;
    min: number;
    total: number;
  };
}

export interface RevenueForecast {
  stationId: string;
  stationName: string;
  forecast: {
    date: string;
    predictedRevenue: number;
    lowerBound: number;
    upperBound: number;
  }[];
  summary: {
    totalPredicted: number;
    averageDaily: number;
    growthRate: number;
  };
}

// ============= WEBSOCKET TYPES =============
export interface WebSocketMessage {
  type: 'TANK_UPDATE' | 'NEW_SALE' | 'ALERT' | 'DELIVERY_UPDATE' | 'NOTIFICATION';
  data: any;
  timestamp: string;
}

export interface TankUpdateMessage {
  tankId: string;
  stationId: string;
  currentLevel: number;
  percentage: number;
  status: TankStatus;
  timestamp: string;
}

export interface SaleAlertMessage {
  saleId: string;
  stationId: string;
  amount: number;
  productType: string;
  timestamp: string;
}

export interface DeliveryUpdateMessage {
  deliveryId: string;
  status: string;
  currentLocation?: string;
  estimatedArrival?: string;
  timestamp: string;
}

export interface NotificationMessage {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  timestamp: string;
}

// ============= JOB TYPES =============
export interface JobData {
  type: 'DAILY_REPORT' | 'INVENTORY_ALERT' | 'DELIVERY_REMINDER' | 'BACKUP' | 'SYNC';
  data: any;
  scheduledAt: string;
}

export interface JobResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  executedAt: string;
}

// ============= DASHBOARD TYPES =============
export interface ExecutiveDashboardData {
  totalDailySales: number;
  fuelStockLevels: {
    pms: number;
    ago: number;
  };
  totalExpenses: number;
  pendingApprovals: number;
  salesByProduct: {
    pms: number;
    lpg: number;
    ago: number;
    lubricants: number;
  };
  topPerformingStations: {
    id: string;
    name: string;
    manager: string;
    sales: number;
    target: number;
    health: 'normal' | 'warning' | 'critical';
  }[];
  recentActivity: {
    title: string;
    description: string;
    time: string;
    type: 'sale' | 'expense' | 'inventory' | 'delivery' | 'approval';
  }[];
}

export interface StationDashboardData {
  station: Station;
  today: {
    sales: number;
    volume: number;
    transactions: number;
  };
  monthlySales: number;
  tanks: Tank[];
  recentTransactions: Sale[];
  inventoryHealth: {
    tank: string;
    product: string;
    level: number;
    capacity: number;
    percentage: number;
    status: TankStatus;
  }[];
}