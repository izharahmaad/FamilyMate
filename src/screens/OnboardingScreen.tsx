import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  StatusBar,
  Image,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "../theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Onboarding">;

type Slide = {
  id: string;
  title1: string;
  title2: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  icon2?: keyof typeof Ionicons.glyphMap;
  image: any;
};

const { width, height } = Dimensions.get("window");

const BG_DARK = "#0B1020";
const TEXT = "rgba(255,255,255,0.92)";
const TEXT_MUTED = "rgba(255,255,255,0.72)";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

function FinanceTexture() {
  // Same texture language as Login (receipt + chart + dots + trend lines).
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[
          "rgba(91,95,239,0.22)",
          "rgba(91,95,239,0.08)",
          "rgba(0,0,0,0.00)",
        ]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.texReceipt, { top: 92, left: 16, opacity: 0.10 }]}>
        <View style={styles.texReceiptHeader} />
        <View style={styles.texReceiptLine} />
        <View style={[styles.texReceiptLine, { width: 132 }]} />
        <View style={[styles.texReceiptLine, { width: 156 }]} />
        <View style={[styles.texReceiptLine, { width: 110 }]} />
        <View style={styles.texReceiptFooter} />
      </View>

      <View style={[styles.texChart, { bottom: 120, left: 18, opacity: 0.10 }]}>
        <View style={[styles.texBar, { height: 12 }]} />
        <View style={[styles.texBar, { height: 22 }]} />
        <View style={[styles.texBar, { height: 16 }]} />
        <View style={[styles.texBar, { height: 30 }]} />
      </View>

      <View style={[styles.texDots, { top: 210, right: 20, opacity: 0.08 }]}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={styles.texDot} />
        ))}
      </View>

      <View style={[styles.texTrendWrap, { top: 110, right: -46, opacity: 0.06 }]}>
        <View style={styles.texTrendLine} />
        <View style={[styles.texTrendLine, { top: 34, width: 210 }]} />
        <View style={[styles.texTrendLine, { top: 68, width: 240 }]} />
      </View>
    </View>
  );
}

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const slides: Slide[] = useMemo(
    () => [
      {
        id: "1",
        title1: "Add expenses in",
        title2: "seconds",
        subtitle: "Snap a receipt or type it in. Keeping track has never been this easy.",
        icon: "receipt-outline",
        icon2: "add-circle",
        image: require("../../assets/onboarding/receipt.jpg"),
      },
      {
        id: "2",
        title1: "See clear analytics",
        title2: "instantly",
        subtitle: "Understand where your money goes with beautiful, easy-to-read reports.",
        icon: "stats-chart-outline",
        image: require("../../assets/onboarding/analytics.jpg"),
      },
      {
        id: "3",
        title1: "Track family",
        title2: "spending together",
        subtitle: "Manage shared household expenses in real-time with your family.",
        icon: "people-outline",
        image: require("../../assets/onboarding/family.jpg"),
      },
      {
        id: "4",
        title1: "Stay within your",
        title2: "monthly budget",
        subtitle: "Set limits and get notified before you overspend.",
        icon: "wallet-outline",
        image: require("../../assets/onboarding/budget.jpg"),
      },
    ],
    []
  );

  const ref = useRef<Animated.FlatList<Slide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const [index, setIndex] = useState(0);
  const lastIndex = slides.length - 1;
  const isLast = index === lastIndex;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(clamp(i, 0, lastIndex));
  };

  const goTo = (i: number) => {
    const next = clamp(i, 0, lastIndex);
    ref.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const goToLogin = () => navigation.replace("Login");

  const onPrimary = () => {
    if (!isLast) return goTo(index + 1);
    goToLogin();
  };

  const onSkip = () => {
    if (!isLast) return goTo(lastIndex);
    goToLogin();
  };

  const buttonLabel = isLast ? "Get Started" : "Next";

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FinanceTexture />

      <Animated.FlatList
        ref={ref}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        renderItem={({ item, index: i }) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

          const bgOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });

          const contentOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.70, 1, 0.70],
            extrapolate: "clamp",
          });

          const contentTranslateY = scrollX.interpolate({
            inputRange,
            outputRange: [14, 0, 14],
            extrapolate: "clamp",
          });

          const iconScale = scrollX.interpolate({
            inputRange,
            outputRange: [0.96, 1, 0.96],
            extrapolate: "clamp",
          });

          const showSkip = i !== lastIndex;

          return (
            <View style={[styles.page, { width }]}>
              {/* Darkened photo background per slide */}
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
                <Image source={item.image} style={styles.bg} resizeMode="cover" />
                <LinearGradient
                  colors={[
                    "rgba(11,16,32,0.35)",
                    "rgba(11,16,32,0.65)",
                    "rgba(11,16,32,0.90)",
                    BG_DARK,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {/* Header */}
              <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
                {showSkip ? (
                  <Pressable
                    onPress={onSkip}
                    hitSlop={12}
                    style={({ pressed }) => [
                      styles.skipPill,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <Ionicons name="play-skip-forward-outline" size={16} color="#fff" />
                    <View style={styles.skipDivider} />
                    <Text style={styles.skipText}>Skip</Text>
                  </Pressable>
                ) : (
                  <View style={{ width: 92 }} />
                )}
              </View>

              {/* Content */}
              <Animated.View
                style={[
                  styles.content,
                  { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] },
                ]}
              >
                <Animated.View style={[styles.iconStack, { transform: [{ scale: iconScale }] }]}>
                  <View style={styles.iconTile}>
                    <LinearGradient
                      colors={["rgba(91,95,239,0.26)", "rgba(255,255,255,0.06)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name={item.icon} size={78} color="#fff" />
                  </View>

                  {!!item.icon2 && (
                    <View style={styles.iconBadge}>
                      <LinearGradient
                        colors={[theme.colors.primary, theme.colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons name={item.icon2} size={22} color="#fff" />
                    </View>
                  )}
                </Animated.View>

                <Text style={styles.title}>
                  {item.title1}
                  {"\n"}
                  <Text style={styles.titleAccent}>{item.title2}</Text>
                </Text>

                <Text style={styles.subtitle}>{item.subtitle}</Text>

                <View style={styles.dots}>
                  {slides.map((s, d) => {
                    const r = [(d - 1) * width, d * width, (d + 1) * width];

                    const w = scrollX.interpolate({
                      inputRange: r,
                      outputRange: [7, 24, 7],
                      extrapolate: "clamp",
                    });

                    const o = scrollX.interpolate({
                      inputRange: r,
                      outputRange: [0.24, 1, 0.24],
                      extrapolate: "clamp",
                    });

                    return (
                      <Animated.View
                        key={s.id}
                        style={[
                          styles.dot,
                          {
                            width: w,
                            opacity: o,
                            backgroundColor:
                              d === index ? theme.colors.primary : "rgba(255,255,255,0.18)",
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </Animated.View>

              {/* Bottom CTA */}
              <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                <Pressable onPress={onPrimary} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
                  <View style={styles.buttonWrap}>
                    <LinearGradient
                      colors={[theme.colors.primary, theme.colors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.button}
                    >
                      <Text style={styles.buttonText}>{buttonLabel}</Text>
                      <Ionicons
                        name={isLast ? "chevron-forward-circle" : "arrow-forward-circle-outline"}
                        size={26}
                        color="#fff"
                        style={{ marginLeft: 10 }}
                      />
                    </LinearGradient>
                  </View>
                </Pressable>

                <View style={{ height: 18 }} />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_DARK },
  page: { flex: 1, height },
  bg: { width: "100%", height: "100%" },

  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  skipPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  skipDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: 10,
  },
  skipText: { fontFamily: theme.font.bold, fontSize: 14, color: "#fff" },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
    alignItems: "center",
  },

  iconStack: { position: "relative", alignItems: "center", justifyContent: "center" },
  iconTile: {
    width: 150,
    height: 150,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  iconBadge: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: 46,
    height: 46,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },

  title: {
    marginTop: 20,
    fontFamily: theme.font.bold,
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center",
    color: TEXT,
    letterSpacing: -0.35,
  },
  titleAccent: { color: theme.colors.primary },

  subtitle: {
    marginTop: 12,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: TEXT_MUTED,
    paddingHorizontal: 18,
    maxWidth: 420,
  },

  dots: { flexDirection: "row", justifyContent: "center", marginTop: 22 },
  dot: { height: 8, borderRadius: 999, marginHorizontal: 6 },

  bottom: { paddingHorizontal: 22, paddingTop: 10 },
  buttonWrap: { borderRadius: 999, overflow: "hidden" },
  button: {
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: 18,
  },
  buttonText: { fontFamily: theme.font.bold, color: "#fff", fontSize: 16 },

  // ---- same texture pieces as login ----
  texReceipt: {
    position: "absolute",
    width: 176,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  texReceiptHeader: {
    height: 10,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
    width: 120,
  },
  texReceiptLine: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 8,
    width: 150,
  },
  texReceiptFooter: {
    height: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 4,
    width: 90,
    alignSelf: "flex-end",
  },

  texChart: {
    position: "absolute",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  texBar: {
    width: 10,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  texDots: {
    position: "absolute",
    width: 140,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  texDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  texTrendWrap: {
    position: "absolute",
    width: 280,
    height: 120,
    transform: [{ rotate: "-12deg" }],
  },
  texTrendLine: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 2,
    width: 230,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
