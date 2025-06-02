import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap } from "lucide-react"

export default function BenchmarksPage() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Performance Benchmarks</h1>
        <p className="text-xl text-gray-600">
          Solidis delivers blazing-fast performance with zero dependencies. See how it compares to other Redis clients.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Benchmark Methodology
          </CardTitle>
          <CardDescription>
            1000 concurrent commands × 10 iterations, 1 KB random-string payload per request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4\
