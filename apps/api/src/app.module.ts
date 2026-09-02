import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/guards";
import { RolesGuard } from "./auth/roles.guard";
import { TerminalsModule } from "./terminals/terminals.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { OutletsModule } from "./outlets/outlets.module";
import { UsersModule } from "./users/users.module";
import { MenuModule } from "./menu/menu.module";
import { OrdersModule } from "./orders/orders.module";
import { KdsModule } from "./kds/kds.module";
import { InventoryModule } from "./inventory/inventory.module";
import { CrmModule } from "./crm/crm.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { ReportsModule } from "./reports/reports.module";
import { PartnerModule } from "./partner/partner.module";
import { SyncModule } from "./sync/sync.module";
import { EventsModule } from "./events/events.module";
import { PrintModule } from "./print/print.module";
import { AuditModule } from "./audit/audit.module";
import { DevicesModule } from "./devices/devices.module";
import { MarginsModule } from "./margins/margins.module";
import { RecommendationsModule } from "./recommendations/recommendations.module";
import { DeveloperModule } from "./developer/developer.module";
import { DiagnosticsModule } from "./diagnostics/diagnostics.module";
import { FoodSafetyModule } from "./food-safety/food-safety.module";
import { FranchiseModule } from "./franchise/franchise.module";
import { TrainingModule } from "./training/training.module";
import { StaffModule } from "./staff/staff.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { WaitlistModule } from "./waitlist/waitlist.module";
import { PayrollModule } from "./payroll/payroll.module";
import { HrModule } from "./hr/hr.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    EventsModule,
    AuthModule,
    TerminalsModule,
    AuditModule,
    DevicesModule,
    OrganizationsModule,
    OutletsModule,
    UsersModule,
    MenuModule,
    OrdersModule,
    KdsModule,
    InventoryModule,
    CrmModule,
    ReservationsModule,
    WaitlistModule,
    ReportsModule,
    PartnerModule,
    SyncModule,
    PrintModule,
    MarginsModule,
    RecommendationsModule,
    DeveloperModule,
    DiagnosticsModule,
    FoodSafetyModule,
    FranchiseModule,
    TrainingModule,
    StaffModule,
    ApprovalsModule,
    PayrollModule,
    HrModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
