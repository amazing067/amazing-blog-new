import Link from "next/link";
import { Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-navy-900 bg-[#1e293b] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">어메이징사업부</h1>
          </div>
          <Link
            href="/login"
            className="px-6 py-2 bg-white text-[#1e293b] font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            로그인
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-[#1e293b] mb-6">
            보험 영업의 새로운 기준
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            어메이징사업부와 함께 스마트한 보험 영업을 시작하세요
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-[#1e293b] mb-3">
                체계적 관리
              </h3>
              <p className="text-gray-600">
                고객 정보와 상담 내역을 효율적으로 관리할 수 있습니다
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-[#1e293b] mb-3">
                실시간 지원
              </h3>
              <p className="text-gray-600">
                필요한 정보와 자료를 즉시 확인하고 활용할 수 있습니다
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-[#1e293b] mb-3">
                안전한 보안
              </h3>
              <p className="text-gray-600">
                고객의 소중한 정보를 안전하게 보호합니다
              </p>
            </div>
        </div>

          <div className="mt-16">
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-[#1e293b] text-white font-semibold rounded-lg hover:bg-[#334155] transition-colors text-lg"
            >
              지금 시작하기
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1e293b] text-white py-8 mt-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-300">
            © 2025 어메이징사업부. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
