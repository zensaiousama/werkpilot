'use client';

import dynamic from 'next/dynamic';

const SocialProofToast = dynamic(() => import('./SocialProofToast'), { ssr: false });
const ExitIntentPopup = dynamic(() => import('./ExitIntentPopup'), { ssr: false });
const StickyMobileCTA = dynamic(() => import('./StickyMobileCTA'), { ssr: false });
const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false });
const ScrollToTop = dynamic(() => import('./ScrollToTop'), { ssr: false });
const DeferredAnalytics = dynamic(() => import('./DeferredAnalytics'), { ssr: false });

export default function ClientOverlays() {
  return (
    <>
      <SocialProofToast />
      <ExitIntentPopup />
      <StickyMobileCTA />
      <ChatWidget />
      <ScrollToTop />
      <DeferredAnalytics />
    </>
  );
}
