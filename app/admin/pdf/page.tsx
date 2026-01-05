'use client'

import { useState, useEffect } from 'react'
import { Upload, FileText, Trash2, Loader2 } from 'lucide-react'

interface PDFFile {
  name: string
  path: string
  publicUrl: string
  category: 'damage' | 'life' | 'unknown'
  size: number
  createdAt: string
  updatedAt: string
}

export default function PDFManagementPage() {
  const [pdfs, setPdfs] = useState<PDFFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<'damage' | 'life'>('damage')

  // PDF 목록 불러오기
  const loadPDFs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/pdf/list')
      const data = await response.json()
      
      if (data.success) {
        setPdfs(data.pdfs || [])
      } else {
        console.error('PDF 목록 로드 실패:', data.error)
        alert('PDF 목록을 불러올 수 없습니다: ' + (data.error || '알 수 없는 오류'))
      }
    } catch (error: any) {
      console.error('PDF 목록 로드 오류:', error)
      alert('PDF 목록을 불러오는 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPDFs()
  }, [])

  // PDF 업로드
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드 가능합니다.')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', uploadCategory)

      const response = await fetch('/api/admin/pdf/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        alert('PDF 업로드가 완료되었습니다!')
        loadPDFs() // 목록 새로고침
      } else {
        alert('PDF 업로드 실패: ' + (data.error || '알 수 없는 오류'))
      }
    } catch (error: any) {
      console.error('PDF 업로드 오류:', error)
      alert('PDF 업로드 중 오류가 발생했습니다: ' + (error?.message || '알 수 없는 오류'))
    } finally {
      setIsUploading(false)
      // 파일 입력 초기화
      e.target.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'damage':
        return '손해보험'
      case 'life':
        return '생명보험'
      default:
        return '기타'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'damage':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'life':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            PDF 소식지 관리
          </h1>

          {/* 업로드 섹션 */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  카테고리 선택
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as 'damage' | 'life')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isUploading}
                >
                  <option value="damage">손해보험 소식지</option>
                  <option value="life">생명보험 소식지</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  PDF 파일 업로드
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      파일 선택
                    </>
                  )}
                </label>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 손해보험 소식지 모음집 또는 생명보험 소식지 모음집 PDF를 업로드하세요.
            </p>
          </div>

          {/* PDF 목록 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">업로드된 PDF 목록</h2>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="text-gray-500 mt-2">로딩 중...</p>
              </div>
            ) : pdfs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>업로드된 PDF가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pdfs.map((pdf) => (
                  <div
                    key={pdf.name}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <h3 className="font-semibold text-gray-800 truncate">{pdf.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs border ${getCategoryColor(pdf.category)}`}>
                            {getCategoryLabel(pdf.category)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(pdf.size)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          업로드: {new Date(pdf.createdAt || pdf.updatedAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={pdf.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors text-sm text-center"
                      >
                        미리보기
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

