'use client';

import dynamic from 'next/dynamic';

const SocialProofToast = dynamic(() => import('./SocialProofToast'), { ssr: false });
const ExitIntentPopup = dynamic(() => import('./ExitIntentPopup'), { ssr: false });
const StickyMobileCTA = dynamic(() => import('./StickyMobileCTA'), { ssr: false });
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });
const ScrollToTop = dynamic(() => import('./ScrollToTop'), { ssr: false });
const DeferredAnalytics = dynamic(() => import('./DeferredAnalytics'), { ssr: false });
const OfflineBanner = dynamic(() => import('./OfflineBanner'), { ssr: false });
const EasterEgg = dynamic(() => import('./EasterEgg'), { ssr: false });
const CookieConsent = dynamic(() => import('./CookieConsent'), { ssr: false });
const WebVitals = dynamic(() => import('./WebVitals'), { ssr: false });
const KeyboardNav = dynamic(() => import('./KeyboardNav'), { ssr: false });
const PerformanceBudget = dynamic(() => import('./PerformanceBudget'), { ssr: false });
const InstantPageLoad = dynamic(() => import('./InstantPageLoad'), { ssr: false });
const MobileBottomSheet = dynamic(() => import('./MobileBottomSheet'), { ssr: false });
const AdaptiveLoader = dynamic(() => import('./AdaptiveLoader'), { ssr: false });
const ProgressiveOnboarding = dynamic(() => import('./ProgressiveOnboarding'), { ssr: false });
const AccessibilityEnhancer = dynamic(() => import('./AccessibilityEnhancer'), { ssr: false });
const PageTransitionProgress = dynamic(() => import('./PageTransitionProgress'), { ssr: false });

export default function ClientOverlays() {
  return (
    <>
      <OfflineBanner />
      <EasterEgg />
      <CookieConsent />
      <SocialProofToast />
      <ExitIntentPopup />
      <StickyMobileCTA />
      <ChatWidget />
      <ScrollToTop />
      <DeferredAnalytics />
      <WebVitals />
      <KeyboardNav />
      <PerformanceBudget />
      <InstantPageLoad />
      <MobileBottomSheet />
      <AdaptiveLoader />
      <ProgressiveOnboarding />
      <AccessibilityEnhancer />
      <PageTransitionProgress />
    </>
  );
}
