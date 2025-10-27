"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, ArrowRight } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

export default function TutorialsPage() {
  const { t } = useI18n()

  const tutorials = [
    {
      title: t("tutorials.sessionStore"),
      description: t("tutorials.sessionStoreDesc"),
      difficulty: t("tutorials.beginner"),
      duration: "15 min",
      tags: ["sessions", "web", "authentication"],
      href: "/tutorials/session-store",
    },
    {
      title: t("tutorials.cacheLayer"),
      description: t("tutorials.cacheLayerDesc"),
      difficulty: t("tutorials.intermediate"),
      duration: "25 min",
      tags: ["caching", "performance", "database"],
      href: "/tutorials/cache-layer",
    },
    {
      title: t("tutorials.chatApp"),
      description: t("tutorials.chatAppDesc"),
      difficulty: t("tutorials.advanced"),
      duration: "45 min",
      tags: ["pubsub", "realtime", "websockets"],
      href: "/tutorials/chat-app",
    },
    {
      title: t("tutorials.rateLimiting"),
      description: t("tutorials.rateLimitingDesc"),
      difficulty: t("tutorials.intermediate"),
      duration: "20 min",
      tags: ["rate-limiting", "api", "security"],
      href: "/tutorials/rate-limiting",
    },
    {
      title: t("tutorials.distributedLocking"),
      description: t("tutorials.distributedLockingDesc"),
      difficulty: t("tutorials.advanced"),
      duration: "30 min",
      tags: ["locking", "distributed", "concurrency"],
      href: "/tutorials/distributed-locking",
    },
    {
      title: t("tutorials.jobQueue"),
      description: t("tutorials.jobQueueDesc"),
      difficulty: t("tutorials.intermediate"),
      duration: "35 min",
      tags: ["queues", "jobs", "background"],
      href: "/tutorials/job-queue",
    },
  ]

  const getDifficultyColor = (difficulty: string) => {
    const beginner = t("tutorials.beginner")
    const intermediate = t("tutorials.intermediate")
    const advanced = t("tutorials.advanced")

    if (difficulty === beginner) return "bg-green-100 text-green-800"
    if (difficulty === intermediate) return "bg-yellow-100 text-yellow-800"
    if (difficulty === advanced) return "bg-red-100 text-red-800"
    return "bg-gray-100 text-gray-800"
  }

  return (
    <div className="container mx-auto max-w-6xl py-12 px-4">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">{t("tutorials.title")}</h1>
        <p className="text-xl text-gray-600">
          {t("tutorials.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorials.map((tutorial, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow group">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <Badge className={getDifficultyColor(tutorial.difficulty)}>{tutorial.difficulty}</Badge>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  {tutorial.duration}
                </div>
              </div>
              <CardTitle className="group-hover:text-yellow-600 transition-colors">{tutorial.title}</CardTitle>
              <CardDescription>{tutorial.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {tutorial.tags.map((tag, tagIndex) => (
                  <Badge key={tagIndex} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Link
                href={tutorial.href}
                className="inline-flex items-center text-yellow-600 hover:text-yellow-800 font-medium text-sm"
              >
                {t("tutorials.startTutorial")}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Learning Path */}
      <div className="mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              {t("tutorials.learningPath")}
            </CardTitle>
            <CardDescription>{t("tutorials.learningPathDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-semibold">
                  1
                </div>
                <div>
                  <div className="font-medium">{t("tutorials.step1")}</div>
                  <div className="text-sm text-gray-600">{t("tutorials.step1Desc")}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
                  2
                </div>
                <div>
                  <div className="font-medium">{t("tutorials.step2")}</div>
                  <div className="text-sm text-gray-600">{t("tutorials.step2Desc")}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center text-yellow-800 font-semibold">
                  3
                </div>
                <div>
                  <div className="font-medium">{t("tutorials.step3")}</div>
                  <div className="text-sm text-gray-600">{t("tutorials.step3Desc")}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 font-semibold">
                  4
                </div>
                <div>
                  <div className="font-medium">{t("tutorials.step4")}</div>
                  <div className="text-sm text-gray-600">{t("tutorials.step4Desc")}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
