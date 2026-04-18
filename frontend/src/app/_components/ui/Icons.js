import React from 'react';
import {
  LayoutDashboard,
  User,
  Users,
  DoorOpen,
  FileSignature,
  Receipt,
  CreditCard,
  BarChart2,
  Menu,
  X,
  AlertCircle,
  History,
  Search,
  TrendingUp,
  PlusCircle,
  ShieldCheck
} from 'lucide-react';

const withDefaultProps = (IconComponent) => {
  return function IconWrapper(props) {
    // Preserve the exact optical weight from the design system (strokeWidth="1.8")
    return <IconComponent strokeWidth={1.8} aria-hidden="true" {...props} />;
  };
};

export const DashboardIcon = withDefaultProps(LayoutDashboard);
export const TenantIcon = withDefaultProps(User);
export const UserManagementIcon = withDefaultProps(Users);
export const RoomIcon = withDefaultProps(DoorOpen);
export const ContractIcon = withDefaultProps(FileSignature);
export const BillingIcon = withDefaultProps(Receipt);
export const PaymentIcon = withDefaultProps(CreditCard);
export const ReportIcon = withDefaultProps(BarChart2);

export const HamburgerMenuIcon = withDefaultProps(Menu);
export const XIcon = withDefaultProps(X);
export const AlertCircleIcon = withDefaultProps(AlertCircle);
export const HistoryIcon = withDefaultProps(History);
export const SearchIcon = withDefaultProps(Search);
export const TrendingUpIcon = withDefaultProps(TrendingUp);
export const PlusCircleIcon = withDefaultProps(PlusCircle);
export const ComplianceIcon = withDefaultProps(ShieldCheck);
