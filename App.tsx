import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Pressable,
  Linking,
  Switch,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isLarge = SCREEN_WIDTH > 768;

// -- Design Tokens --
const COLORS = {
  bg: '#070A12',
  bgElevated: '#0F1420',
  bgCard: '#111827',
  bgCardHover: '#151E30',
  border: '#1E293B',
  borderLight: '#25324A',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textFaint: '#64748B',
  accent: '#06B6D4',
  accent2: '#8B5CF6',
  accent3: '#F59E0B',
  success: '#10B981',
  cyanGlow: 'rgba(6,182,214,0.15)',
  violetGlow: 'rgba(139,92,246,0.12)',
};

type InfraNodeType = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  decision: string;
  tradeoff: string;
};

const INFRA_NODES: InfraNodeType[] = [
  {
    id: 'gateway',
    label: 'API Gateway',
    sub: 'Kong • gRPC',
    x: 50,
    y: 14,
    color: COLORS.accent,
    icon: 'git-merge-outline',
    decision: 'Chose Kong over AWS API Gateway for portable mTLS and plugin parity across clouds.',
    tradeoff: 'More ops overhead, but avoided vendor lock-in and enabled canary plugins at the edge.',
  },
  {
    id: 'kafka',
    label: 'Kafka',
    sub: 'Event Bus • 42k msg/s',
    x: 78,
    y: 32,
    color: COLORS.accent3,
    icon: 'swap-horizontal-outline',
    decision: 'Kafka with exactly-once semantics + Outbox pattern for ledger consistency.',
    tradeoff: 'Operational complexity vs. RabbitMQ — justified by replay & audit requirements.',
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    sub: 'Citus • 3TB',
    x: 78,
    y: 68,
    color: '#38BDF8',
    icon: 'server-outline',
    decision: 'Citus for horizontal sharding without leaving Postgres ecosystem.',
    tradeoff: 'Shard rebalancing pain vs. immediate DX; deferred Vitess migration.',
  },
  {
    id: 'k8s',
    label: 'Kubernetes',
    sub: 'EKS • 180 pods',
    x: 50,
    y: 86,
    color: COLORS.accent2,
    icon: 'cube-outline',
    decision: 'EKS + Karpenter for bin-packing; GitOps with Argo Rollouts.',
    tradeoff: 'Higher control plane cost but 34% infra savings via spot + consolidation.',
  },
  {
    id: 'observability',
    label: 'Observability',
    sub: 'OTel • Grafana',
    x: 22,
    y: 68,
    color: COLORS.success,
    icon: 'pulse-outline',
    decision: 'OpenTelemetry collectors → Mimir/Loki/Tempo, unified exemplars.',
    tradeoff: 'Upfront instrumentation tax, but MTTR dropped from 42m → 9m.',
  },
  {
    id: 'edge',
    label: 'Edge Cache',
    sub: 'Cloudflare • CDN',
    x: 22,
    y: 32,
    color: '#EC4899',
    icon: 'globe-outline',
    decision: 'Cloudflare Workers for auth at edge + stale-while-revalidate.',
    tradeoff: 'Cold start <5ms vs. origin offload 81% — worth the WASM eval.',
  },
];

const EDGES: [string, string][] = [
  ['gateway', 'kafka'],
  ['gateway', 'edge'],
  ['kafka', 'postgres'],
  ['kafka', 'observability'],
  ['postgres', 'k8s'],
  ['observability', 'k8s'],
  ['edge', 'observability'],
  ['edge', 'gateway'],
];

const CASE_STUDIES = [
  {
    id: 'ledger',
    title: 'Global Payment Ledger',
    company: 'Fintech Unicorn • Series D',
    role: 'Staff Engineer — Tech Lead',
    timeframe: '2023 — 2024 • 9 months',
    team: '8 engineers • 2 product • Design partner',
    hero: 'Ledger re-platform handling $2.1B daily volume with zero double-spend.',
    problem:
      'Legacy double-entry ledger on Aurora hit write contention at ~1.2k TPS. Reconciliation jobs ran 4.5 hours, blocking settlement. Compliance required immutable audit chain + retro-correction without mutation.',
    constraints: ['PCI DSS Level 1', '99.99% uptime', '42ms p95 budget', 'SOC 2 + immutable trail'],
    architectureNote: 'Event-sourced ledger: API Gateway → Kafka (outbox) → Aggregates (Go) → Citus Postgres (sharded by tenant) → Materialized projections. Shadow traffic mirrored for 6 weeks.',
    tradeoffs: [
      { choice: 'Kafka Outbox vs CDC', pick: 'Outbox pattern', why: 'Guaranteed at-least-once without Debezium ops; app owns transaction boundary.' },
      { choice: 'Citus vs CockroachDB', pick: 'Citus', why: 'Stay in Postgres, team expert; re-shard script > migration risk.' },
    ],
    implementation: [
      'Designed idempotency keys with 72h window + deterministic UUIDv7 ledger IDs',
      'Built Go aggregate service with event sourcing, snapshot every 500 events',
      'Implemented double-entry invariant checks as DB constraints + async verifier',
      'Canary + shadow test against legacy for 6 weeks, 0.003% divergence caught',
    ],
    collaboration:
      'Partnered with Risk and Finance to model correction journals. Ran weekly architecture reviews with 3 eng managers. Mentored 2 mid-level engineers to own projections.',
    outcomes: [
      { k: '4.5h → 11 min', v: 'Reconciliation' },
      { k: '1.2k → 8.4k', v: 'TPS sustained' },
      { k: '0', v: 'Double-spend incidents (12mo)' },
      { k: '99.99%', v: 'Uptime' },
    ],
    github: 'github.com/alexrivera/ledger-projections',
    live: 'ledger.alexrivera.design',
    lessons: 'Auditability is a product feature, not an afterthought. Event sourcing shines when correction is first-class — but snapshot strategy makes or breaks read p99.',
    highlightNodes: ['gateway', 'kafka', 'postgres'],
    accent: '#06B6D4',
    tps: '8.4k TPS',
    latency: '18ms p95',
  },
  {
    id: 'telemetry',
    title: 'Real-time Telemetry Platform',
    company: 'Industrial IoT • 4.2M devices',
    role: 'Lead Platform Engineer',
    timeframe: '2022 — 2023 • 11 months',
    team: '12 engineers • Platform + SRE',
    hero: 'Ingestion & observability for 4.2M edge devices, 42k msg/s with 9s MTTR.',
    problem:
      'MQTT broker + Postgres swallowed 14k msg/s then shed load. No distributed tracing; on-call pages took 42 min MTTR. Customers demanded per-device lag visibility.',
    constraints: ['42k msg/s peak', 'Cost cap $0.08 / M device/day', 'P99 lag <2s', 'On-prem + cloud hybrid'],
    architectureNote:
      'MQTT → Kafka (tiered storage) → Flink (windowed aggregations) → ClickHouse → Grafana. OTel collectors on edge gateway; Mimir/Loki/Tempo unified with exemplars.',
    tradeoffs: [
      { choice: 'Flink vs Kinesis Analytics', pick: 'Flink on K8s', why: 'Exactly-once windows + backpressure control; KDA opaque scaling.' },
      { choice: 'ClickHouse vs TimescaleDB', pick: 'ClickHouse', why: '10x compression for metrics; materialized views for rollups.' },
    ],
    implementation: [
      'Replaced single broker with EMQX cluster (3 AZ) + Kafka tiered storage to S3',
      'Flink jobs for 1s / 1m / 1h rollups with late-arrival handling',
      'OTel instrumentation with tail sampling — trace cost -63%',
      'SLO dashboards with burn-rate alerts, error budget automation',
    ],
    collaboration:
      'Led incident review guild, cut alert noise -71%. Pair-built runbooks with SRE. Taught workshop on cardinality bombs.',
    outcomes: [
      { k: '42k', v: 'msg/s sustained' },
      { k: '42m → 9m', v: 'MTTR' },
      { k: '-71%', v: 'Alert noise' },
      { k: '-38%', v: 'Infra cost / device' },
    ],
    github: 'github.com/alexrivera/otel-edge-collector',
    live: 'telemetry.demo.alexrivera.design',
    lessons: 'Cardinality is the silent killer. Tail sampling + careful label discipline saved more than any infra scaling.',
    highlightNodes: ['kafka', 'observability', 'k8s'],
    accent: '#10B981',
    tps: '42k msg/s',
    latency: '1.2s P99 lag',
  },
  {
    id: 'designsys',
    title: 'Multi-tenant Platform & Design System',
    company: 'B2B SaaS • 340 tenants',
    role: 'Staff Engineer — Platform Architecture',
    timeframe: '2021 — 2022 • 7 months',
    team: '6 engineers • Design systems',
    hero: 'Platform that let 340 tenants ship branded workspaces without forking.',
    problem:
      'Tenant theming was CSS overrides in prod — 340 forks, 19 min build, design drift everywhere. No isolation; one tenant CSS leak broke others.',
    constraints: ['19 → <3 min builds', 'Zero cross-tenant leak', 'Design tokens must be runtime swappable', 'Next.js 14 App Router'],
    architectureNote:
      'Next.js 15 RSC + Tailwind + shadcn + CSS variables per tenant, edge middleware for tenant resolution. Module Federation for micro-frontends, tokens in Postgres + Cloudflare KV.',
    tradeoffs: [
      { choice: 'CSS Modules vs CSS variables', pick: 'CSS variables at :root', why: 'Runtime swap without rebuild; SSR-safe with RSC.' },
      { choice: 'Monorepo vs MF', pick: 'Turborepo + MF', why: 'Shared tokens, independent deploy; MF for tenant plugins.' },
    ],
    implementation: [
      'Tenant resolver at Edge (Cloudflare) → KV cache, <2ms resolution',
      'Token pipeline: Figma → Style Dictionary → CSS vars + TS types',
      'Build pipeline with Turborepo remote cache, 19m → 2.4m',
      'Visual regression with Chromatic, 340 tenant snapshots',
    ],
    collaboration:
      'Co-led with Design Director. Ran RFC process (7 RFCs, 42 comments avg). Mentored frontend guild on RSC mental model.',
    outcomes: [
      { k: '19m → 2.4m', v: 'Build time' },
      { k: '0', v: 'Cross-tenant leaks (18mo)' },
      { k: '340', v: 'Tenants • 1 codebase' },
      { k: '+41', v: 'NPS internal DX' },
    ],
    github: 'github.com/alexrivera/tenant-tokens',
    live: 'platform.alexrivera.design',
    lessons: 'Design systems fail on governance, not tech. Token contracts + RFC process mattered more than the bundler.',
    highlightNodes: ['edge', 'gateway', 'k8s'],
    accent: '#8B5CF6',
    tps: '340 tenants',
    latency: '2.4m build',
  },
];

const PRINCIPLES = [
  {
    title: 'API Design',
    icon: 'code-slash-outline',
    desc: 'Versionless, evolvable contracts. Idempotency by default, explicit error taxonomy, and generated clients that don’t lie.',
    points: ['OpenAPI + spectral lint', 'Idempotency keys', 'Cursor pagination'],
    color: '#06B6D4',
  },
  {
    title: 'Resilience',
    icon: 'shield-checkmark-outline',
    desc: 'Systems fail — gracefully. Bulkheads, circuit breakers, and backpressure over retries.',
    points: ['Outbox pattern', 'Saga choreography', 'Load shedding'],
    color: '#10B981',
  },
  {
    title: 'Performance',
    icon: 'speedometer-outline',
    desc: 'Latency is a feature. p95 budgets, edge compute, and data locality before cache layers.',
    points: ['Edge middleware', 'SWR + KV', 'p95 SLOs'],
    color: '#F59E0B',
  },
  {
    title: 'Security',
    icon: 'lock-closed-outline',
    desc: 'Zero trust, least privilege, and auditability baked in — not bolted on.',
    points: ['mTLS • OPA', 'Immutable audit log', 'Secret rotation'],
    color: '#EC4899',
  },
  {
    title: 'Developer Experience',
    icon: 'hammer-outline',
    desc: 'Platform leverage: pave the road, make the happy path the secure path.',
    points: ['Golden paths', 'RFC culture', 'Remote cache'],
    color: '#8B5CF6',
  },
];

const REPOS = [
  { name: 'outbox-kt', desc: 'Kotlin outbox + CDC-lite for Postgres • 1.4k ★', lang: 'Kotlin', stars: 1420, color: '#A97BFF' },
  { name: 'otel-tail-sampler', desc: 'Tail sampling collector for high-cardinality traces', lang: 'Go', stars: 892, color: '#00ADD8' },
  { name: 'tenant-tokens', desc: 'Figma → CSS variables pipeline with type generation', lang: 'TypeScript', stars: 2104, color: '#3178C6' },
  { name: 'k8s-cost-optimizer', desc: 'Karpenter recommender • saved $420k/yr', lang: 'Rust', stars: 634, color: '#DEA584' },
];

const LANG_DIST = [
  { lang: 'TypeScript', pct: 42, color: '#3178C6' },
  { lang: 'Go', pct: 28, color: '#00ADD8' },
  { lang: 'Kotlin', pct: 18, color: '#A97BFF' },
  { lang: 'Rust', pct: 12, color: '#DEA584' },
];

const TIMELINE = [
  {
    role: 'Staff Engineer, Platform',
    org: 'Ledger Financial • Remote',
    time: '2023 — Present',
    scope: 'Leads 18-person platform org (2 teams) • Owns ledger & settlement platform ($2.1B/day)',
    impact: ['Re-platformed ledger to 8.4k TPS, 0 incidents', 'Mentored 5 engineers to senior', 'Introduced RFC + ADRs — 23 decisions documented'],
    tech: ['Go', 'Kafka', 'Citus', 'EKS', 'OTel'],
  },
  {
    role: 'Lead Engineer, Infrastructure',
    org: 'Orbital IoT',
    time: '2021 — 2023',
    scope: 'Led 12-person infra team • 4.2M devices • On-call for ingestion',
    impact: ['Cut MTTR 42→9m, alert noise -71%', 'Built telemetry platform 42k msg/s', 'Cost / device -38% via tiered storage'],
    tech: ['EMQX', 'Flink', 'ClickHouse', 'Grafana'],
  },
  {
    role: 'Senior Full-Stack Engineer',
    org: 'SaaSWorks',
    time: '2018 — 2021',
    scope: 'Tech lead for multi-tenant platform • 340 tenants',
    impact: ['Build 19m→2.4m with Turborepo', 'Zero cross-tenant leaks 18mo', 'Design system adopted by 42 engineers'],
    tech: ['Next.js', 'Tailwind', 'Module Fed', 'Cloudflare'],
  },
  {
    role: 'Software Engineer',
    org: 'Consultancy → Scale-up',
    time: '2015 — 2018',
    scope: 'Full-stack across fintech + logistics',
    impact: ['Shipped 14 products 0→1', 'Introduced event sourcing patterns', 'First on-call rotation design'],
    tech: ['Node.js', 'Postgres', 'React', 'AWS'],
  },
];

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [selectedNode, setSelectedNode] = useState<InfraNodeType | null>(null);
  const [showNodeSheet, setShowNodeSheet] = useState(false);
  const [expandedCase, setExpandedCase] = useState<number | null>(0);
  const [showResume, setShowResume] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 750);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
      return;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reducedMotion]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const scrollTo = (key: string) => {
    const y = sectionY.current[key];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: y - 72, animated: !reducedMotion });
    }
    setShowNav(false);
  };

  if (!fontsLoaded) return null;

  const activeNodes = CASE_STUDIES[activeCase].highlightNodes;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />

        {/* Top Nav - Sticky */}
        <View style={styles.nav}>
          <View style={styles.navInner}>
            <View style={styles.navLeft}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>AR</Text>
              </View>
              <View>
                <Text style={styles.navName}>Alex Rivera</Text>
                <Text style={styles.navSub}>Staff Engineer • Platform</Text>
              </View>
            </View>

            <View style={styles.navRight}>
              {/* Reduced motion */}
              <View style={styles.motionToggle}>
                <Ionicons name={reducedMotion ? 'pause-circle-outline' : 'play-circle-outline'} size={14} color={reducedMotion ? COLORS.textFaint : COLORS.accent} />
                <Text style={[styles.motionLabel, reducedMotion && { color: COLORS.textFaint }]}>{reducedMotion ? 'Static' : 'Motion'}</Text>
                <Switch
                  value={!reducedMotion}
                  onValueChange={(v) => setReducedMotion(!v)}
                  trackColor={{ false: '#1E293B', true: '#0E7490' }}
                  thumbColor={Platform.OS === 'android' ? (reducedMotion ? '#64748B' : '#06B6D4') : undefined}
                  style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                />
              </View>

              <TouchableOpacity onPress={() => setShowNav(true)} style={styles.menuBtn} accessibilityLabel="Open navigation menu">
                <Ionicons name="menu-outline" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Desktop nav pills - hidden on small if needed but we keep scrollable */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navPills}>
            {[
              { k: 'work', l: 'Work' },
              { k: 'architecture', l: 'Architecture' },
              { k: 'opensource', l: 'Open Source' },
              { k: 'about', l: 'About' },
              { k: 'contact', l: 'Contact' },
            ].map((p) => (
              <TouchableOpacity key={p.k} onPress={() => scrollTo(p.k)} style={styles.pill}>
                <Text style={styles.pillText}>{p.l}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.pill, styles.pillPrimary]} onPress={() => scrollTo('contact')}>
              <Text style={styles.pillPrimaryText}>Hire Alex</Text>
              <Ionicons name="arrow-forward-outline" size={12} color="#fff" />
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Skip link visual */}
          <View style={styles.skipLink}>
            <Text style={styles.skipText}>Skip to content • Press menu to navigate</Text>
          </View>

          {/* HERO */}
          <View style={styles.hero}>
            {/* Grid bg */}
            <View style={styles.gridBg} pointerEvents="none">
              <View style={styles.gridLineH} />
              <View style={[styles.gridLineH, { top: 120 }]} />
              <View style={[styles.gridLineH, { top: 240 }]} />
              <View style={styles.gridLineV} />
              <View style={[styles.gridLineV, { left: '50%' }]} />
              <View style={[styles.gridLineV, { right: 0, left: undefined }]} />
            </View>

            {/* Availability badge */}
            <AnimatedReanimated.View entering={FadeIn.duration(600)} style={styles.badgeRow}>
              <View style={styles.availabilityBadge}>
                <View style={styles.dot} />
                <Text style={styles.badgeText}>Available for Staff / Lead roles — Q2 2026</Text>
                <View style={styles.badgeLive}>
                  <Text style={styles.badgeLiveText}>● Live</Text>
                </View>
              </View>
              <View style={styles.locationBadge}>
                <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.locationText}>Remote • CET • ±4h overlap</Text>
              </View>
            </AnimatedReanimated.View>

            <AnimatedReanimated.View entering={FadeInUp.delay(150).duration(700)}>
              <Text style={styles.eyebrow}>Digital Architecture Studio — Est. 2015</Text>
              <Text style={styles.heroTitle}>
                designs reliable{'\n'}software systems{'\n'}
                <Text style={styles.heroAccent}>that scale.</Text>
              </Text>
              <Text style={styles.heroSub}>
                Staff Full-Stack Engineer specializing in <Text style={styles.heroStrong}>distributed systems</Text> and platform architecture. I help product teams ship resilient, observable platforms without the rebuild.
              </Text>
            </AnimatedReanimated.View>

            <View style={styles.heroMeta}>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaNum}>8.4k TPS</Text>
                <Text style={styles.heroMetaLabel}>Peak sustained</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaNum}>$2.1B</Text>
                <Text style={styles.heroMetaLabel}>Daily volume</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaNum}>42m → 9m</Text>
                <Text style={styles.heroMetaLabel}>MTTR improvement</Text>
              </View>
            </View>

            <View style={styles.ctaRow}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={() => scrollTo('work')} activeOpacity={0.9}>
                <Text style={styles.ctaPrimaryText}>View selected systems</Text>
                <Ionicons name="arrow-down-outline" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctaSecondary} onPress={() => setShowResume(true)} activeOpacity={0.85}>
                <Ionicons name="document-text-outline" size={16} color={COLORS.text} />
                <Text style={styles.ctaSecondaryText}>Download résumé</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.trustRow}>
              <Text style={styles.trustLabel}>TRUSTED BY TEAMS AT</Text>
              <View style={styles.trustLogos}>
                {['LEDGER', 'ORBITAL', 'SAASWORKS', 'FINTECH CO'].map((l) => (
                  <Text key={l} style={styles.trustLogo}>{l}</Text>
                ))}
              </View>
            </View>
          </View>

          {/* INFRASTRUCTURE MAP - Interactive 3D mesh */}
          <View
            onLayout={(e) => (sectionY.current['architecture'] = e.nativeEvent.layout.y)}
            style={styles.mapSection}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.kicker}>02 — ARCHITECTURE</Text>
                <Text style={styles.sectionTitle}>Infrastructure Map</Text>
                <Text style={styles.sectionDesc}>Slowly rotating mesh of connected services. Tap a node to see the decision. Scroll case studies to morph.</Text>
              </View>
              <View style={styles.mapControls}>
                <View style={[styles.mapControlDot, { backgroundColor: COLORS.accent }]} />
                <Text style={styles.mapControlText}>Interactive • {reducedMotion ? 'Static view' : 'Live WebGL (sim.)'}</Text>
              </View>
            </View>

            {/* Active case tabs for morph */}
            <View style={styles.morphTabs}>
              {CASE_STUDIES.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setActiveCase(i)}
                  style={[styles.morphTab, activeCase === i && { borderColor: c.accent, backgroundColor: `${c.accent}14` }]}
                >
                  <View style={[styles.morphDot, { backgroundColor: c.accent }]} />
                  <Text style={[styles.morphTabText, activeCase === i && { color: COLORS.text }]}>{c.title.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setReducedMotion(!reducedMotion)} style={styles.staticBtn}>
                <Ionicons name={reducedMotion ? 'eye-off-outline' : 'eye-outline'} size={12} color={COLORS.textMuted} />
                <Text style={styles.staticBtnText}>{reducedMotion ? 'Enable motion' : 'Reduce motion'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mapCard}>
              {!mapReady ? (
                <View style={styles.skeletonMap}>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                  <View style={styles.skeletonMesh}>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={styles.skeletonNode} />
                    ))}
                  </View>
                  <Text style={styles.skeletonText}>Loading WebGL • dynamic import…</Text>
                </View>
              ) : (
                <>
                  {/* Mesh container */}
                  <View style={styles.meshWrap}>
                    {/* Simulated 3D rotation container */}
                    <AnimatedReanimated.View style={[styles.meshInner, !reducedMotion && rotateStyle]}>
                      {/* Edges */}
                      <View style={styles.edgesLayer} pointerEvents="none">
                        {EDGES.map(([a, b], idx) => {
                          const nA = INFRA_NODES.find((n) => n.id === a)!;
                          const nB = INFRA_NODES.find((n) => n.id === b)!;
                          const isActive = activeNodes.includes(a as any) && activeNodes.includes(b as any);
                          // compute line
                          const x1 = (nA.x / 100) * 280;
                          const y1 = (nA.y / 100) * 280;
                          const x2 = (nB.x / 100) * 280;
                          const y2 = (nB.y / 100) * 280;
                          const dx = x2 - x1;
                          const dy = y2 - y1;
                          const len = Math.sqrt(dx * dx + dy * dy);
                          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.edge,
                                {
                                  left: x1,
                                  top: y1,
                                  width: len,
                                  transform: [{ rotate: `${angle}deg` }],
                                  backgroundColor: isActive ? COLORS.accent : '#1E293B',
                                  opacity: isActive ? 0.9 : 0.35,
                                  height: isActive ? 1.5 : 1,
                                },
                              ]}
                            />
                          );
                        })}
                      </View>

                      {/* Nodes */}
                      {INFRA_NODES.map((node) => {
                        const isActive = activeNodes.includes(node.id as any);
                        const isSelected = selectedNode?.id === node.id;
                        return (
                          <TouchableOpacity
                            key={node.id}
                            onPress={() => {
                              setSelectedNode(node);
                              setShowNodeSheet(true);
                            }}
                            activeOpacity={0.85}
                            style={[
                              styles.node,
                              {
                                left: `${node.x}%`,
                                top: `${node.y}%`,
                                borderColor: isActive ? node.color : '#25324A',
                                backgroundColor: isActive ? `${node.color}18` : '#0B1220',
                                shadowColor: node.color,
                                shadowOpacity: isActive ? 0.4 : 0,
                              },
                              isSelected && { borderColor: node.color, backgroundColor: `${node.color}28` },
                            ]}
                          >
                            <AnimatedReanimated.View style={!reducedMotion && isActive ? pulseStyle : undefined}>
                              <View style={[styles.nodeIcon, { backgroundColor: `${node.color}24` }]}>
                                <Ionicons name={node.icon} size={16} color={node.color} />
                              </View>
                            </AnimatedReanimated.View>
                            <Text style={[styles.nodeLabel, isActive && { color: COLORS.text }]}>{node.label}</Text>
                            <Text style={styles.nodeSub}>{node.sub}</Text>
                            {isActive && <View style={[styles.nodeActiveRing, { borderColor: node.color }]} />}
                          </TouchableOpacity>
                        );
                      })}
                    </AnimatedReanimated.View>

                    {/* Center label */}
                    <View style={styles.centerBadge} pointerEvents="none">
                      <Text style={styles.centerBadgeText}>{CASE_STUDIES[activeCase].tps}</Text>
                      <Text style={styles.centerBadgeSub}>{CASE_STUDIES[activeCase].latency}</Text>
                    </View>
                  </View>

                  <View style={styles.mapFooter}>
                    <View style={styles.mapLegend}>
                      {INFRA_NODES.slice(0, 3).map((n) => (
                        <View key={n.id} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: n.color }]} />
                          <Text style={styles.legendText}>{n.label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.mapHint}>Tap any service • Scroll case studies to morph</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.accessibilityNote}>
              <Ionicons name="accessibility-outline" size={14} color={COLORS.textFaint} />
              <Text style={styles.accessibilityText}>
                WebGL gracefully degrades to static SVG on low-power devices. Motion honors prefers-reduced-motion. All nodes keyboard operable.
              </Text>
            </View>
          </View>

          {/* CASE STUDIES */}
          <View onLayout={(e) => (sectionY.current['work'] = e.nativeEvent.layout.y)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>01 — SELECTED WORK</Text>
                <Text style={styles.sectionTitle}>Systems that survived scale</Text>
                <Text style={styles.sectionDesc}>Three detailed case studies — problem, constraints, trade-offs, and measurable outcomes. No hand-waving.</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>3 CASE STUDIES</Text>
              </View>
            </View>

            {CASE_STUDIES.map((cs, idx) => {
              const isExpanded = expandedCase === idx;
              const isActive = activeCase === idx;
              return (
                <TouchableOpacity
                  key={cs.id}
                  activeOpacity={0.98}
                  onPress={() => {
                    setExpandedCase(isExpanded ? null : idx);
                    setActiveCase(idx);
                    if (!isExpanded) {
                      // scroll slightly to show detail
                    }
                  }}
                  style={[styles.caseCard, isActive && { borderColor: `${cs.accent}55`, shadowColor: cs.accent }]}
                >
                  <View style={styles.caseTopBar} >
                    <View style={[styles.caseAccent, { backgroundColor: cs.accent }]} />
                    <Text style={styles.caseIndex}>0{idx + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.caseCompany}>{cs.company}</Text>
                      <Text style={styles.caseTitle}>{cs.title}</Text>
                    </View>
                    <View style={[styles.caseStatus, isActive && { backgroundColor: `${cs.accent}18`, borderColor: `${cs.accent}44` }]}>
                      <View style={[styles.caseStatusDot, { backgroundColor: cs.accent }]} />
                      <Text style={[styles.caseStatusText, isActive && { color: cs.accent }]}>{isActive ? 'Active in map' : cs.tps}</Text>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={COLORS.textMuted} />
                  </View>

                  <View style={styles.caseHeroRow}>
                    <View style={[styles.caseHeroIcon, { backgroundColor: `${cs.accent}14`, borderColor: `${cs.accent}30` }]}>
                      <Ionicons name={idx === 0 ? 'card-outline' : idx === 1 ? 'analytics-outline' : 'layers-outline'} size={22} color={cs.accent} />
                    </View>
                    <Text style={styles.caseHeroText}>{cs.hero}</Text>
                  </View>

                  <View style={styles.caseMetaRow}>
                    <View style={styles.caseMetaChip}>
                      <Ionicons name="person-outline" size={12} color={COLORS.textFaint} />
                      <Text style={styles.caseMetaText}>{cs.role}</Text>
                    </View>
                    <View style={styles.caseMetaChip}>
                      <Ionicons name="time-outline" size={12} color={COLORS.textFaint} />
                      <Text style={styles.caseMetaText}>{cs.timeframe}</Text>
                    </View>
                    <View style={styles.caseMetaChip}>
                      <Ionicons name="people-outline" size={12} color={COLORS.textFaint} />
                      <Text style={styles.caseMetaText}>{cs.team}</Text>
                    </View>
                  </View>

                  {/* Collapsed preview diagram */}
                  <View style={styles.miniDiagram}>
                    <View style={styles.miniDiagramLine} />
                    <View style={styles.miniDiagramNodes}>
                      {cs.highlightNodes.map((nid) => {
                        const n = INFRA_NODES.find((x) => x.id === nid)!;
                        return (
                          <View key={nid} style={[styles.miniNode, { borderColor: n.color }]}>
                            <Ionicons name={n.icon} size={12} color={n.color} />
                            <Text style={styles.miniNodeText}>{n.label}</Text>
                          </View>
                        );
                      })}
                      <Ionicons name="arrow-forward-outline" size={14} color={COLORS.textFaint} />
                      <Text style={styles.miniNote}>{cs.architectureNote.slice(0, 52)}…</Text>
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.caseExpanded}>
                      {/* Problem */}
                      <View style={styles.caseBlock}>
                        <Text style={styles.caseBlockTitle}>
                          <Ionicons name="alert-circle-outline" size={12} color={cs.accent} /> Problem
                        </Text>
                        <Text style={styles.caseBlockText}>{cs.problem}</Text>
                      </View>

                      <View style={styles.constraintsRow}>
                        {cs.constraints.map((c) => (
                          <View key={c} style={styles.constraintChip}>
                            <Text style={styles.constraintText}>{c}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Architecture */}
                      <View style={styles.caseBlock}>
                        <Text style={styles.caseBlockTitle}>
                          <Ionicons name="git-branch-outline" size={12} color={cs.accent} /> System Diagram
                        </Text>
                        <View style={[styles.diagramBox, { borderColor: `${cs.accent}30` }]}>
                          <Text style={styles.diagramText}>{cs.architectureNote}</Text>
                          <View style={styles.diagramFlow}>
                            {cs.highlightNodes.map((nid, i) => {
                              const n = INFRA_NODES.find((x) => x.id === nid)!;
                              return (
                                <React.Fragment key={nid}>
                                  <View style={[styles.flowNode, { borderColor: n.color, backgroundColor: `${n.color}14` }]}>
                                    <Text style={[styles.flowNodeText, { color: n.color }]}>{n.label}</Text>
                                  </View>
                                  {i < cs.highlightNodes.length - 1 && <Ionicons name="arrow-forward" size={12} color={cs.accent} />}
                                </React.Fragment>
                              );
                            })}
                          </View>
                        </View>
                      </View>

                      {/* Tradeoffs */}
                      <View style={styles.caseBlock}>
                        <Text style={styles.caseBlockTitle}>
                          <Ionicons name="scale-outline" size={12} color={cs.accent} /> Technical Trade-offs
                        </Text>
                        {cs.tradeoffs.map((t) => (
                          <View key={t.choice} style={styles.tradeRow}>
                            <View style={styles.tradeChoice}>
                              <Text style={styles.tradeChoiceLabel}>{t.choice}</Text>
                              <View style={[styles.tradePick, { backgroundColor: `${cs.accent}14`, borderColor: `${cs.accent}40` }]}>
                                <Text style={[styles.tradePickText, { color: cs.accent }]}>→ {t.pick}</Text>
                              </View>
                            </View>
                            <Text style={styles.tradeWhy}>{t.why}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Implementation */}
                      <View style={styles.caseBlock}>
                        <Text style={styles.caseBlockTitle}>
                          <Ionicons name="construct-outline" size={12} color={cs.accent} /> Implementation
                        </Text>
                        {cs.implementation.map((s, i) => (
                          <View key={i} style={styles.bulletRow}>
                            <View style={[styles.bullet, { backgroundColor: cs.accent }]} />
                            <Text style={styles.bulletText}>{s}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.caseBlock}>
                        <Text style={styles.caseBlockTitle}>
                          <Ionicons name="people-outline" size={12} color={cs.accent} /> Collaboration
                        </Text>
                        <Text style={styles.caseBlockText}>{cs.collaboration}</Text>
                      </View>

                      {/* Outcomes */}
                      <View style={[styles.outcomesGrid, { borderColor: `${cs.accent}20` }]}>
                        {cs.outcomes.map((o) => (
                          <View key={o.v} style={styles.outcomeCell}>
                            <Text style={[styles.outcomeK, { color: cs.accent }]}>{o.k}</Text>
                            <Text style={styles.outcomeV}>{o.v}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Links */}
                      <View style={styles.caseLinks}>
                        <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(`https://${cs.github}`)}>
                          <Ionicons name="logo-github" size={14} color={COLORS.text} />
                          <Text style={styles.linkBtnText}>{cs.github}</Text>
                          <Ionicons name="open-outline" size={12} color={COLORS.textFaint} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.linkBtn, styles.linkBtnLive]} onPress={() => Linking.openURL(`https://${cs.live}`)}>
                          <Ionicons name="globe-outline" size={14} color={cs.accent} />
                          <Text style={[styles.linkBtnText, { color: cs.accent }]}>{cs.live}</Text>
                          <Ionicons name="open-outline" size={12} color={cs.accent} />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.lessonBox, { borderColor: `${cs.accent}25`, backgroundColor: `${cs.accent}08` }]}>
                        <Text style={styles.lessonTitle}>
                          <Ionicons name="bulb-outline" size={12} color={cs.accent} /> Lessons Learned
                        </Text>
                        <Text style={styles.lessonText}>{cs.lessons}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* PRINCIPLES */}
          <View style={styles.section}>
            <Text style={styles.kicker}>03 — PRINCIPLES</Text>
            <Text style={styles.sectionTitle}>Architecture principles</Text>
            <Text style={styles.sectionDesc}>Opinionated defaults that keep velocity high and incidents low.</Text>

            <View style={styles.principlesGrid}>
              {PRINCIPLES.map((p) => (
                <View key={p.title} style={[styles.principleCard, { borderColor: `${p.color}22` }]}>
                  <View style={[styles.principleIcon, { backgroundColor: `${p.color}14`, borderColor: `${p.color}30` }]}>
                    <Ionicons name={p.icon as any} size={18} color={p.color} />
                  </View>
                  <Text style={styles.principleTitle}>{p.title}</Text>
                  <Text style={styles.principleDesc}>{p.desc}</Text>
                  <View style={styles.principlePoints}>
                    {p.points.map((pt) => (
                      <View key={pt} style={styles.principlePoint}>
                        <View style={[styles.principleDot, { backgroundColor: p.color }]} />
                        <Text style={styles.principlePointText}>{pt}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* OPEN SOURCE */}
          <View onLayout={(e) => (sectionY.current['opensource'] = e.nativeEvent.layout.y)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.kicker}>04 — OPEN SOURCE</Text>
                <Text style={styles.sectionTitle}>GitHub activity</Text>
                <Text style={styles.sectionDesc}>Building in public — tooling that survived production.</Text>
              </View>
              <TouchableOpacity style={styles.githubLink} onPress={() => Linking.openURL('https://github.com/alexrivera')}>
                <Ionicons name="logo-github" size={16} color={COLORS.text} />
                <Text style={styles.githubLinkText}>github.com/alexrivera</Text>
                <Ionicons name="open-outline" size={12} color={COLORS.textFaint} />
              </TouchableOpacity>
            </View>

            {/* GitHub profile header */}
            <View style={styles.githubHeader}>
              <Image
                source={{ uri: 'https://i.pravatar.cc/200?img=68' }}
                style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#1E293B' }}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.githubName}>Alex Rivera</Text>
                <Text style={styles.githubBio}>Staff Engineer • Distributed systems • OTel & platform DX</Text>
                <View style={styles.githubStats}>
                  <Text style={styles.githubStat}><Text style={styles.githubStatNum}>1.4k</Text> followers</Text>
                  <Text style={styles.githubStat}>•</Text>
                  <Text style={styles.githubStat}><Text style={styles.githubStatNum}>87</Text> repos</Text>
                  <Text style={styles.githubStat}>•</Text>
                  <Text style={styles.githubStat}><Text style={styles.githubStatNum}>4.2k</Text> stars</Text>
                </View>
              </View>
              <View style={styles.githubBadge}>
                <Text style={styles.githubBadgeText}>★ 4.2k total</Text>
              </View>
            </View>

            {/* Language distribution */}
            <View style={styles.langCard}>
              <View style={styles.langHeader}>
                <Text style={styles.langTitle}>Language distribution</Text>
                <Text style={styles.langSub}>Last 12 months • by commits</Text>
              </View>
              <View style={styles.langBar}>
                {LANG_DIST.map((l) => (
                  <View key={l.lang} style={[styles.langSegment, { flex: l.pct, backgroundColor: l.color }]} />
                ))}
              </View>
              <View style={styles.langLegend}>
                {LANG_DIST.map((l) => (
                  <View key={l.lang} style={styles.langLegendItem}>
                    <View style={[styles.langDot, { backgroundColor: l.color }]} />
                    <Text style={styles.langLegendText}>{l.lang} {l.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Contribution graph mock */}
            <View style={styles.contribCard}>
              <View style={styles.contribHeader}>
                <Text style={styles.contribTitle}>412 contributions in the last year</Text>
                <Text style={styles.contribSub}>Contribution activity • GitHub API integration</Text>
              </View>
              <View style={styles.contribGrid}>
                {Array.from({ length: 112 }).map((_, i) => {
                  const intensity = [0, 1, 2, 3, 4][Math.floor(Math.random() * 5)] as number;
                  const colors = ['#0F172A', '#0E4B5E', '#0E7490', '#06B6D4', '#22D3EE'];
                  // deterministic pseudo
                  const c = colors[(i * 7 + i % 3) % 5];
                  return <View key={i} style={[styles.contribCell, { backgroundColor: c, opacity: 0.9 }]} />;
                })}
              </View>
              <View style={styles.contribLegend}>
                <Text style={styles.contribLegendText}>Less</Text>
                {['#0F172A', '#0E4B5E', '#06B6D4', '#22D3EE'].map((c) => (
                  <View key={c} style={[styles.contribLegendBox, { backgroundColor: c }]} />
                ))}
                <Text style={styles.contribLegendText}>More</Text>
              </View>
            </View>

            {/* Pinned repos */}
            <View style={styles.repoGrid}>
              {REPOS.map((r) => (
                <TouchableOpacity key={r.name} style={styles.repoCard} activeOpacity={0.9} onPress={() => Linking.openURL(`https://github.com/alexrivera/${r.name}`)}>
                  <View style={styles.repoTop}>
                    <Ionicons name="book-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.repoName}>{r.name}</Text>
                    <View style={styles.repoPublic}>
                      <Text style={styles.repoPublicText}>Public</Text>
                    </View>
                  </View>
                  <Text style={styles.repoDesc}>{r.desc}</Text>
                  <View style={styles.repoBottom}>
                    <View style={styles.repoLang}>
                      <View style={[styles.repoLangDot, { backgroundColor: r.color }]} />
                      <Text style={styles.repoLangText}>{r.lang}</Text>
                    </View>
                    <View style={styles.repoStars}>
                      <Ionicons name="star-outline" size={12} color={COLORS.textFaint} />
                      <Text style={styles.repoStarsText}>{r.stars.toLocaleString()}</Text>
                    </View>
                    <Ionicons name="git-branch-outline" size={12} color={COLORS.textFaint} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CAREER TIMELINE */}
          <View onLayout={(e) => (sectionY.current['about'] = e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.kicker}>05 — CAREER</Text>
            <Text style={styles.sectionTitle}>Leadership & impact</Text>
            <Text style={styles.sectionDesc}>From 0→1 builder to platform owner — mentoring and multiplying.</Text>

            <View style={styles.timeline}>
              {/* Vertical line */}
              <View style={styles.timelineLine} />

              {TIMELINE.map((item, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, idx === 0 && { backgroundColor: COLORS.accent, borderColor: COLORS.accent, shadowColor: COLORS.accent }]}>
                    {idx === 0 && <View style={styles.timelineDotInner} />}
                  </View>
                  <View style={[styles.timelineCard, idx === 0 && { borderColor: `${COLORS.accent}30`, backgroundColor: '#0F1F2E' }]}>
                    <View style={styles.timelineHeader}>
                      <View>
                        <Text style={[styles.timelineRole, idx === 0 && { color: COLORS.accent }]}>{item.role}</Text>
                        <Text style={styles.timelineOrg}>{item.org}</Text>
                      </View>
                      <View style={[styles.timelineTime, idx === 0 && { backgroundColor: `${COLORS.accent}14`, borderColor: `${COLORS.accent}40` }]}>
                        <Text style={[styles.timelineTimeText, idx === 0 && { color: COLORS.accent }]}>{item.time}</Text>
                      </View>
                    </View>
                    <Text style={styles.timelineScope}>{item.scope}</Text>
                    <View style={styles.timelineImpacts}>
                      {item.impact.map((imp) => (
                        <View key={imp} style={styles.timelineImpactRow}>
                          <Ionicons name="checkmark-circle" size={12} color={idx === 0 ? COLORS.accent : COLORS.success} />
                          <Text style={styles.timelineImpactText}>{imp}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.techRow}>
                      {item.tech.map((t) => (
                        <View key={t} style={styles.techChip}>
                          <Text style={styles.techChipText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.mentoringCard}>
              <View style={styles.mentoringIcon}>
                <Ionicons name="school-outline" size={20} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mentoringTitle}>Mentoring & team health</Text>
                <Text style={styles.mentoringText}>Mentored 11 engineers (5 to Senior), ran incident-review guild, introduced ADRs & RFCs. Teams I led averaged 4.6/5 engagement and {'<'}2% regretted attrition.</Text>
              </View>
            </View>
          </View>

          {/* HIRING CTA */}
          <View onLayout={(e) => (sectionY.current['contact'] = e.nativeEvent.layout.y)} style={styles.hiringSection}>
            <View style={styles.hiringCard}>
              <View style={styles.hiringGlow} />
              <Text style={styles.hiringKicker}>06 — LET’S BUILD</Text>
              <Text style={styles.hiringTitle}>Building a high-leverage engineering team?</Text>
              <Text style={styles.hiringDesc}>
                I partner with product & platform teams to turn fragile systems into reliable platforms — without the big rewrite. Staff-level IC or tech-lead, hands-on + strategic.
              </Text>

              <View style={styles.hiringPoints}>
                {[
                  'Platform & distributed systems architecture',
                  'Incident resilience & SLO practice',
                  'Mentoring senior engineers & leveling',
                ].map((p) => (
                  <View key={p} style={styles.hiringPoint}>
                    <View style={styles.hiringCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                    <Text style={styles.hiringPointText}>{p}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.hiringCtas}>
                <TouchableOpacity style={styles.hiringPrimary} onPress={() => Linking.openURL('https://cal.com/alexrivera/intro')}>
                  <Ionicons name="calendar-outline" size={16} color="#fff" />
                  <Text style={styles.hiringPrimaryText}>Book 30-min intro</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.hiringSecondary} onPress={() => Linking.openURL('mailto:alex@alexrivera.design')}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.text} />
                  <Text style={styles.hiringSecondaryText}>alex@alexrivera.design</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.hiringSecondary} onPress={() => Linking.openURL('https://linkedin.com/in/alexrivera')}>
                  <Ionicons name="logo-linkedin" size={16} color="#0A66C2" />
                  <Text style={styles.hiringSecondaryText}>LinkedIn</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.hiringMeta}>
                <View style={styles.hiringMetaItem}>
                  <Ionicons name="time-outline" size={12} color={COLORS.success} />
                  <Text style={styles.hiringMetaText}>Replies within 24h • CET</Text>
                </View>
                <View style={styles.hiringMetaItem}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.textFaint} />
                  <Text style={styles.hiringMetaText}>Available Q2 2026 • Remote-first</Text>
                </View>
              </View>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <View style={styles.footerTop}>
              <View>
                <View style={styles.footerLogoRow}>
                  <View style={styles.logoBoxSm}>
                    <Text style={styles.logoTextSm}>AR</Text>
                  </View>
                  <Text style={styles.footerName}>Alex Rivera</Text>
                </View>
                <Text style={styles.footerTagline}>Staff Engineer • Digital Architecture Studio</Text>
                <Text style={styles.footerCopy}>Designs reliable software systems that scale.</Text>
              </View>
              <View style={styles.footerLinks}>
                <Text style={styles.footerLinksTitle}>Connect</Text>
                {[
                  { icon: 'logo-github', label: 'GitHub', url: 'https://github.com/alexrivera' },
                  { icon: 'logo-linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/alexrivera' },
                  { icon: 'mail-outline', label: 'Email', url: 'mailto:alex@alexrivera.design' },
                  { icon: 'logo-twitter', label: 'X / Twitter', url: 'https://x.com/alexrivera' },
                ].map((s) => (
                  <TouchableOpacity key={s.label} style={styles.footerLink} onPress={() => Linking.openURL(s.url)}>
                    <Ionicons name={s.icon as any} size={14} color={COLORS.textMuted} />
                    <Text style={styles.footerLinkText}>{s.label}</Text>
                    <Ionicons name="open-outline" size={10} color={COLORS.textFaint} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.footerStack}>
              <Text style={styles.footerStackTitle}>Stack & Quality</Text>
              <View style={styles.footerStackChips}>
                {['Next.js 15 • RSC', 'TypeScript', 'R3F • Drei', 'Tailwind • shadcn', 'MDX • Vercel', 'WCAG AA • 100 Lighthouse'].map((c) => (
                  <View key={c} style={styles.stackChip}>
                    <Text style={styles.stackChipText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.footerBottom}>
              <Text style={styles.footerBottomText}>© 2026 Alex Rivera. Crafted with semantic HTML, reduced-motion support, and static fallbacks.</Text>
              <View style={styles.footerBottomLinks}>
                <Text style={styles.footerBottomLink}>Privacy</Text>
                <Text style={styles.footerDot}>•</Text>
                <Text style={styles.footerBottomLink}>Sitemap</Text>
                <Text style={styles.footerDot}>•</Text>
                <Text style={styles.footerBottomLink}>robots.txt</Text>
              </View>
            </View>

            <View style={styles.jsonLd}>
              <Ionicons name="code-outline" size={10} color={COLORS.textFaint} />
              <Text style={styles.jsonLdText}>JSON-LD Person schema • Open Graph • Vercel Analytics • Core Web Vitals optimized</Text>
            </View>
          </View>
        </ScrollView>

        {/* Node Detail Sheet */}
        <Modal visible={showNodeSheet} transparent animationType="slide" onRequestClose={() => setShowNodeSheet(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowNodeSheet(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {selectedNode && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={[styles.sheetIcon, { backgroundColor: `${selectedNode.color}18`, borderColor: `${selectedNode.color}40` }]}>
                    <Ionicons name={selectedNode.icon} size={22} color={selectedNode.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{selectedNode.label}</Text>
                    <Text style={styles.sheetSub}>{selectedNode.sub}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowNodeSheet(false)} style={styles.sheetClose}>
                    <Ionicons name="close-outline" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetBlock}>
                  <View style={styles.sheetLabelRow}>
                    <View style={[styles.sheetLabelDot, { backgroundColor: selectedNode.color }]} />
                    <Text style={styles.sheetLabel}>Technical Decision</Text>
                  </View>
                  <Text style={styles.sheetText}>{selectedNode.decision}</Text>
                </View>

                <View style={[styles.sheetBlock, { backgroundColor: '#1A1F2E', borderColor: '#25324A' }]}>
                  <View style={styles.sheetLabelRow}>
                    <Ionicons name="scale-outline" size={12} color={COLORS.accent3} />
                    <Text style={styles.sheetLabel}>Trade-off</Text>
                  </View>
                  <Text style={styles.sheetText}>{selectedNode.tradeoff}</Text>
                </View>

                <View style={styles.sheetFooter}>
                  <Text style={styles.sheetFooterText}>Accessible • Keyboard operable • Esc to close</Text>
                  <TouchableOpacity style={[styles.sheetBtn, { backgroundColor: selectedNode.color }]} onPress={() => setShowNodeSheet(false)}>
                    <Text style={styles.sheetBtnText}>Got it</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Modal>

        {/* Resume Modal */}
        <Modal visible={showResume} transparent animationType="fade" onRequestClose={() => setShowResume(false)}>
          <View style={styles.resumeBackdrop}>
            <View style={styles.resumeCard}>
              <View style={styles.resumeHeader}>
                <Text style={styles.resumeTitle}>Résumé — Alex Rivera</Text>
                <TouchableOpacity onPress={() => setShowResume(false)} style={styles.resumeClose}>
                  <Ionicons name="close-outline" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.resumePreview}>
                <View style={styles.resumePaper}>
                  <View style={styles.resumePaperHeader}>
                    <Text style={styles.resumeName}>ALEX RIVERA</Text>
                    <Text style={styles.resumeRole}>Staff Engineer • Distributed Systems • Platform</Text>
                    <Text style={styles.resumeContact}>alex@alexrivera.design • github.com/alexrivera • Remote • CET</Text>
                  </View>
                  <View style={styles.resumeLine} />
                  <Text style={styles.resumeSectionTitle}>EXPERIENCE</Text>
                  <Text style={styles.resumeBody}>Staff Engineer, Platform — Ledger Financial (2023—) • Led 18-person platform org, re-platformed ledger to 8.4k TPS, 0 double-spend.</Text>
                  <Text style={styles.resumeBody}>Lead Engineer — Orbital IoT (2021—23) • 4.2M devices, 42k msg/s, MTTR 42→9m.</Text>
                  <Text style={styles.resumeBody}>Senior Engineer — SaaSWorks (2018—21) • Multi-tenant platform, 340 tenants, build 19m→2.4m.</Text>
                  <View style={styles.resumeLine} />
                  <Text style={styles.resumeSectionTitle}>PRINCIPLES • Available Q2 2026</Text>
                  <Text style={styles.resumeBody}>API design • Resilience • Performance • Security • DX. References available.</Text>
                </View>
              </View>
              <View style={styles.resumeActions}>
                <TouchableOpacity style={styles.resumePrimary} onPress={() => { setShowResume(false); }}>
                  <Ionicons name="download-outline" size={16} color="#fff" />
                  <Text style={styles.resumePrimaryText}>Download PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resumeSecondary} onPress={() => setShowResume(false)}>
                  <Text style={styles.resumeSecondaryText}>Close</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.resumeHint}>Optimized for ATS • 1 page • PDF generated from MDX content collection</Text>
            </View>
          </View>
        </Modal>

        {/* Nav Drawer */}
        <Modal visible={showNav} transparent animationType="fade" onRequestClose={() => setShowNav(false)}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setShowNav(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Navigate</Text>
              <TouchableOpacity onPress={() => setShowNav(false)} style={styles.drawerClose}>
                <Ionicons name="close-outline" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {[
              { k: 'work', l: 'Work', d: '3 case studies', icon: 'briefcase-outline' },
              { k: 'architecture', l: 'Architecture', d: 'Live infra map', icon: 'cube-outline' },
              { k: 'opensource', l: 'Open Source', d: 'GitHub & repos', icon: 'logo-github' },
              { k: 'about', l: 'About', d: 'Timeline & mentoring', icon: 'person-outline' },
              { k: 'contact', l: 'Contact', d: 'Hire Alex', icon: 'chatbubble-outline' },
            ].map((item) => (
              <TouchableOpacity key={item.k} style={styles.drawerItem} onPress={() => scrollTo(item.k)}>
                <View style={styles.drawerIcon}>
                  <Ionicons name={item.icon as any} size={18} color={COLORS.accent} />
                </View>
                <View>
                  <Text style={styles.drawerItemLabel}>{item.l}</Text>
                  <Text style={styles.drawerItemDesc}>{item.d}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={COLORS.textFaint} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ))}
            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.drawerCta} onPress={() => { setShowNav(false); scrollTo('contact'); }}>
                <Text style={styles.drawerCtaText}>Book intro — 30 min</Text>
                <Ionicons name="calendar-outline" size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.drawerHint}>Keyboard: Tab to navigate • Esc to close</Text>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  nav: {
    backgroundColor: 'rgba(7,10,18,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: 8,
    zIndex: 10,
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: COLORS.accent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  navName: { color: COLORS.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  navSub: { color: COLORS.textFaint, fontSize: 11, fontWeight: '500' },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  motionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
  },
  motionLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPills: { gap: 8, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  pillPrimary: { backgroundColor: COLORS.accent, borderColor: COLORS.accent, gap: 6 },
  pillPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 0 },
  skipLink: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  skipText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  gridBg: { ...StyleSheet.absoluteFillObject, opacity: 0.04 },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.text },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.text },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0B1A1E',
    borderWidth: 1,
    borderColor: 'rgba(6,182,214,0.25)',
    borderRadius: 20,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success, shadowColor: COLORS.success, shadowOpacity: 0.6, shadowRadius: 4 },
  badgeText: { color: '#A5F3FC', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  badgeLive: { backgroundColor: COLORS.success, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  badgeLiveText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  eyebrow: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  heroTitle: { color: COLORS.text, fontSize: 38, fontWeight: '900', lineHeight: 38, letterSpacing: -1.2 },
  heroAccent: { color: COLORS.accent },
  heroSub: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20, marginTop: 14, maxWidth: 560 },
  heroStrong: { color: COLORS.text, fontWeight: '700' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  heroMetaItem: { flex: 1, alignItems: 'center' },
  heroMetaNum: { color: COLORS.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  heroMetaLabel: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  divider: { width: 1, height: 28, backgroundColor: COLORS.border },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: 'center',
    flex: 1,
  },
  ctaSecondaryText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  trustRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  trustLabel: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  trustLogos: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  trustLogo: { color: '#334155', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  mapSection: { paddingHorizontal: 16, paddingTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  sectionHeaderLeft: { flex: 1, minWidth: 220 },
  kicker: { color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  sectionTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  sectionDesc: { color: COLORS.textMuted, fontSize: 12, lineHeight: 16, marginTop: 6 },
  mapControls: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  mapControlDot: { width: 6, height: 6, borderRadius: 3 },
  mapControlText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },
  morphTabs: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
  morphTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  morphDot: { width: 7, height: 7, borderRadius: 4 },
  morphTabText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  staticBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 'auto',
  },
  staticBtnText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  mapCard: {
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 380,
  },
  skeletonMap: { flex: 1, padding: 20, gap: 12, justifyContent: 'center', alignItems: 'center', minHeight: 380 },
  skeletonLine: { height: 10, width: '80%', backgroundColor: '#1E293B', borderRadius: 6 },
  skeletonMesh: { flexDirection: 'row', gap: 12, marginTop: 12 },
  skeletonNode: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#25324A' },
  skeletonText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600', marginTop: 8 },
  meshWrap: { height: 300, alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: '#070A12' },
  meshInner: { width: 280, height: 280, position: 'relative' },
  edgesLayer: { ...StyleSheet.absoluteFillObject },
  edge: { position: 'absolute', height: 1, borderRadius: 1, transformOrigin: 'left center' as any },
  node: {
    position: 'absolute',
    width: 74,
    height: 74,
    marginLeft: -37,
    marginTop: -37,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  nodeIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  nodeLabel: { color: COLORS.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center', marginTop: 2 },
  nodeSub: { color: COLORS.textFaint, fontSize: 7, fontWeight: '600', textAlign: 'center' },
  nodeActiveRing: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 18, borderWidth: 1, opacity: 0.5, borderStyle: 'dashed' },
  centerBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -10 }],
  },
  centerBadgeText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  centerBadgeSub: { color: COLORS.textFaint, fontSize: 9, fontWeight: '600' },
  mapFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#0B1220', flexWrap: 'wrap', gap: 8 },
  mapLegend: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  mapHint: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  accessibilityNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10 },
  accessibilityText: { color: COLORS.textFaint, fontSize: 10, lineHeight: 14, flex: 1 },

  section: { paddingHorizontal: 16, paddingTop: 28 },
  countBadge: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  countText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  caseCard: {
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  caseTopBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caseAccent: { width: 3, height: 32, borderRadius: 2 },
  caseIndex: { color: COLORS.textFaint, fontSize: 11, fontWeight: '800' },
  caseCompany: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  caseTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  caseStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#0F172A', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  caseStatusDot: { width: 6, height: 6, borderRadius: 3 },
  caseStatusText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
  caseHeroRow: { flexDirection: 'row', gap: 10, marginTop: 12, backgroundColor: '#0B1220', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  caseHeroIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  caseHeroText: { color: COLORS.text, fontSize: 12, fontWeight: '600', lineHeight: 16, flex: 1 },
  caseMetaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  caseMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  caseMetaText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  miniDiagram: { marginTop: 12, backgroundColor: '#070A12', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, overflow: 'hidden', position: 'relative' },
  miniDiagramLine: { position: 'absolute', top: 24, left: 12, right: 12, height: 1, backgroundColor: '#1E293B', opacity: 0.6 },
  miniDiagramNodes: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  miniNode: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  miniNodeText: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  miniNote: { color: COLORS.textFaint, fontSize: 10, flex: 1 },
  caseExpanded: { marginTop: 14, gap: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  caseBlock: { gap: 8 },
  caseBlockTitle: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  caseBlockText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  constraintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  constraintChip: { backgroundColor: '#0B1220', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  constraintText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
  diagramBox: { backgroundColor: '#070A12', borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  diagramText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  diagramFlow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  flowNode: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  flowNodeText: { fontSize: 10, fontWeight: '800' },
  tradeRow: { backgroundColor: '#0B1220', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, gap: 6 },
  tradeChoice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tradeChoiceLabel: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700', flex: 1 },
  tradePick: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tradePickText: { fontSize: 10, fontWeight: '800' },
  tradeWhy: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, flex: 1 },
  outcomesGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0B1220' },
  outcomeCell: { width: '50%', padding: 12, borderWidth: 0.5, borderColor: '#1E293B', alignItems: 'center' },
  outcomeK: { fontSize: 13, fontWeight: '800' },
  outcomeV: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  caseLinks: { gap: 8 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  linkBtnLive: { backgroundColor: '#0B1A1E', borderColor: 'rgba(6,182,214,0.25)' },
  linkBtnText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  lessonBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6 },
  lessonTitle: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  lessonText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },

  principlesGrid: { gap: 12, marginTop: 14 },
  principleCard: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  principleIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  principleTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  principleDesc: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
  principlePoints: { gap: 6, marginTop: 4 },
  principlePoint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  principleDot: { width: 6, height: 6, borderRadius: 3 },
  principlePointText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },

  githubHeader: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 14 },
  githubName: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  githubBio: { color: COLORS.textMuted, fontSize: 11, lineHeight: 14, marginTop: 2 },
  githubStats: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  githubStat: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },
  githubStatNum: { color: COLORS.text, fontWeight: '800' },
  githubBadge: { backgroundColor: '#0B1A1E', borderWidth: 1, borderColor: 'rgba(6,182,214,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  githubBadgeText: { color: COLORS.accent, fontSize: 10, fontWeight: '800' },
  githubLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  githubLinkText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  langCard: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  langHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langTitle: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  langSub: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  langBar: { flexDirection: 'row', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2 },
  langSegment: { borderRadius: 6 },
  langLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  langLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langDot: { width: 8, height: 8, borderRadius: 4 },
  langLegendText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  contribCard: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  contribHeader: { gap: 2 },
  contribTitle: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  contribSub: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  contribGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  contribCell: { width: 10, height: 10, borderRadius: 2 },
  contribLegend: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  contribLegendText: { color: COLORS.textFaint, fontSize: 10 },
  contribLegendBox: { width: 10, height: 10, borderRadius: 2 },
  repoGrid: { gap: 10, marginTop: 12 },
  repoCard: { backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12, gap: 8 },
  repoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repoName: { color: COLORS.accent, fontSize: 12, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  repoPublic: { marginLeft: 'auto', backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  repoPublicText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
  repoDesc: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15 },
  repoBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  repoLang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repoLangDot: { width: 8, height: 8, borderRadius: 4 },
  repoLangText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },
  repoStars: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  repoStarsText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },

  timeline: { marginTop: 16, position: 'relative', paddingLeft: 16 },
  timelineLine: { position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, backgroundColor: '#1E293B', borderRadius: 1 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    zIndex: 1,
  },
  timelineDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  timelineCard: { flex: 1, backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12, gap: 8 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  timelineRole: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  timelineOrg: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  timelineTime: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  timelineTimeText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
  timelineScope: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15, fontStyle: 'italic' },
  timelineImpacts: { gap: 6 },
  timelineImpactRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  timelineImpactText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15, flex: 1 },
  techRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  techChip: { backgroundColor: '#0B1220', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  techChipText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '700' },
  mentoringCard: { flexDirection: 'row', gap: 12, backgroundColor: '#0B1A1E', borderWidth: 1, borderColor: 'rgba(6,182,214,0.2)', borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  mentoringIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(6,182,214,0.12)', borderWidth: 1, borderColor: 'rgba(6,182,214,0.25)', alignItems: 'center', justifyContent: 'center' },
  mentoringTitle: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  mentoringText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },

  hiringSection: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 },
  hiringCard: {
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(6,182,214,0.25)',
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  hiringGlow: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(6,182,214,0.12)' },
  hiringKicker: { color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hiringTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.6, marginTop: 6, lineHeight: 26 },
  hiringDesc: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  hiringPoints: { gap: 8, marginTop: 14 },
  hiringPoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hiringCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  hiringPointText: { color: COLORS.text, fontSize: 12, fontWeight: '600', flex: 1 },
  hiringCtas: { gap: 8, marginTop: 16 },
  hiringPrimary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 13, shadowColor: COLORS.accent, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  hiringPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  hiringSecondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 12 },
  hiringSecondaryText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  hiringMeta: { flexDirection: 'row', gap: 12, marginTop: 14, flexWrap: 'wrap' },
  hiringMetaItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  hiringMetaText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },

  footer: { backgroundColor: '#05070D', borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 16, marginTop: 12 },
  footerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  footerLogoRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  logoBoxSm: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  logoTextSm: { color: COLORS.accent, fontWeight: '800', fontSize: 11 },
  footerName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  footerTagline: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 6 },
  footerCopy: { color: COLORS.textFaint, fontSize: 11, marginTop: 2 },
  footerLinks: { gap: 8, minWidth: 140 },
  footerLinksTitle: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  footerLinkText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', flex: 1 },
  footerStack: { gap: 8 },
  footerStackTitle: { color: COLORS.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  footerStackChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stackChip: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  stackChipText: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  footerBottom: { borderTopWidth: 1, borderTopColor: '#0F172A', paddingTop: 12, gap: 6 },
  footerBottomText: { color: COLORS.textFaint, fontSize: 10, lineHeight: 14 },
  footerBottomLinks: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  footerBottomLink: { color: COLORS.textFaint, fontSize: 10, fontWeight: '600' },
  footerDot: { color: '#1E293B' },
  jsonLd: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, borderStyle: 'dashed' },
  jsonLdText: { color: COLORS.textFaint, fontSize: 9, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#0F1420', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, borderTopWidth: 1, borderColor: COLORS.border, gap: 12, maxHeight: '70%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1E293B', alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sheetIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  sheetSub: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600', marginTop: 2 },
  sheetClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  sheetBlock: { backgroundColor: '#0B1220', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, gap: 8 },
  sheetLabelRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sheetLabelDot: { width: 6, height: 6, borderRadius: 3 },
  sheetLabel: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  sheetText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  sheetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  sheetFooterText: { color: COLORS.textFaint, fontSize: 10, flex: 1 },
  sheetBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  sheetBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  resumeBackdrop: { flex: 1, backgroundColor: 'rgba(7,10,18,0.78)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  resumeCard: { backgroundColor: '#0F1420', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, width: '100%', maxWidth: 520, gap: 12 },
  resumeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumeTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  resumeClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  resumePreview: { backgroundColor: '#05070D', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12 },
  resumePaper: { backgroundColor: '#fff', borderRadius: 8, padding: 14, gap: 8 },
  resumePaperHeader: { alignItems: 'center', gap: 2 },
  resumeName: { color: '#0F172A', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  resumeRole: { color: '#334155', fontSize: 10, fontWeight: '700' },
  resumeContact: { color: '#64748B', fontSize: 9, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', textAlign: 'center' },
  resumeLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  resumeSectionTitle: { color: '#0F172A', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  resumeBody: { color: '#334155', fontSize: 10, lineHeight: 14 },
  resumeActions: { flexDirection: 'row', gap: 10 },
  resumePrimary: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 11 },
  resumePrimaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  resumeSecondary: { paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  resumeSecondaryText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  resumeHint: { color: COLORS.textFaint, fontSize: 10, textAlign: 'center' },

  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, backgroundColor: '#0B0F1A', borderLeftWidth: 1, borderLeftColor: COLORS.border, padding: 16, gap: 8, paddingTop: 48 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  drawerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  drawerClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0F1420', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12 },
  drawerIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(6,182,214,0.12)', borderWidth: 1, borderColor: 'rgba(6,182,214,0.2)', alignItems: 'center', justifyContent: 'center' },
  drawerItemLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  drawerItemDesc: { color: COLORS.textFaint, fontSize: 11, fontWeight: '600' },
  drawerFooter: { marginTop: 'auto', gap: 8 },
  drawerCta: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12 },
  drawerCtaText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  drawerHint: { color: COLORS.textFaint, fontSize: 10, textAlign: 'center' },
});
