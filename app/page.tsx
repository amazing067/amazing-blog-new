import Link from "next/link";
import { Sparkles, MessageSquare, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              어메이징사업부
            </h1>
          </div>
          <Link
            href="/login"
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            로그인
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-block mb-3">
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                ✨ AI 기반 보험 영업 솔루션
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              어메이징사업부 영업지원
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              AI가 자동으로 블로그 글과 Q&A를 생성해드립니다. 이제 영업에만 집중하세요.
            </p>
          </div>

          {/* 핵심 기능 3개 */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-blue-200">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">
                네이버 블로그 자동 생성
              </h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                AI가 보험 상품에 맞는 전문적인 블로그 글을 자동으로 생성합니다. 
                심의 규정을 준수하며, 데이터 시각화까지 포함된 완성도 높은 콘텐츠를 제공합니다.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-purple-200">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">
                보험카페 Q&A 생성기
              </h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                일반인 질문과 전문가 답변을 자동으로 생성합니다. 
                설계서 이미지만 업로드하면 자동으로 분석하여 질문과 답변을 만들어드립니다.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-green-200">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">
                설계서 자동 분석
              </h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                설계서 이미지만 업로드하면 AI가 자동으로 분석하여 상품 정보를 추출합니다. 
                분석 결과를 바탕으로 질문과 답변을 자동으로 생성해드립니다.
              </p>
            </div>
          </div>

          {/* 간단한 CTA */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-center text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-2">
              지금 바로 시작해보세요
            </h3>
            <p className="text-sm text-blue-100 mb-4">
              AI 기반 보험 영업 솔루션을 경험해보세요
            </p>
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl text-base"
            >
              로그인 →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-gray-200 py-4 mt-8">
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes shimmer {
              0% {
                background-position: -200% center;
              }
              100% {
                background-position: 200% center;
              }
            }
          `
        }} />
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-600 mb-2">
            © 2025 어메이징사업부. All rights reserved.
          </p>
          <p className="text-sm text-gray-600 mb-2">
            개발자: 290본부 <span 
              className="font-bold"
              style={{
                background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #c084fc, #a78bfa, #60a5fa)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 3s ease-in-out infinite'
              }}
            >김성민</span>
          </p>
          <p className="text-sm text-gray-600">
            문의: 290본부 본부장 양창대
          </p>
        </div>
      </footer>
    </div>
  );
}
