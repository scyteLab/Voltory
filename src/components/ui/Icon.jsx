/**
 * Icon registry — config/data files name icons as strings, and
 * ONLY the icons registered here are bundled (tree-shaking stays
 * intact; `import * as lucide` would ship the whole library).
 * Adding a new icon = one import + one line in the map.
 */
import {
  AirVent, ArrowRight, BadgeCheck, Banknote, Blend, Building2, Cable,
  ChevronDown, ChevronRight, Circle, Clock, CookingPot, CreditCard,
  Eye, FileBadge, Headphones, Heart, Home, LayoutGrid, LifeBuoy, Lock,
  MapPin, MessageCircle, Package, Phone, Play, Refrigerator, Repeat,
  ScrollText, Search, ShieldCheck, ShoppingCart, Smartphone, Tag,
  Truck, Tv, User, UserPlus, Users, Wallet, WashingMachine, Wrench, Zap,
} from "lucide-react";

const REGISTRY = {
  AirVent, ArrowRight, BadgeCheck, Banknote, Blend, Building2, Cable,
  ChevronDown, ChevronRight, Clock, CookingPot, CreditCard, Eye, FileBadge,
  Headphones, Heart, Home, LayoutGrid, LifeBuoy, Lock, MapPin, MessageCircle,
  Package, Phone, Play, Refrigerator, Repeat, ScrollText, Search, ShieldCheck,
  ShoppingCart, Smartphone, Tag, Truck, Tv, User, UserPlus, Users, Wallet,
  WashingMachine, Wrench, Zap,
};

export default function Icon({ name, size = 16, ...rest }) {
  const Cmp = REGISTRY[name] || Circle;
  return <Cmp size={size} strokeWidth={2} {...rest} />;
}