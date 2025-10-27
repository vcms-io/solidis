"use client"

import Link from "next/link"
import { Github, Twitter, Mail } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="bg-gray-900 text-white py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <img src="https://resources.vcms.io/assets/solidis.png" alt="Solidis Logo" className="h-8 w-8" />
              <span className="font-bold text-xl">Solidis</span>
            </div>
            <p className="text-gray-400 text-sm">
              {t("footer.description")}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t("footer.documentation")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/getting-started" className="text-gray-400 hover:text-white">
                  {t("nav.gettingStarted")}
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="text-gray-400 hover:text-white">
                  {t("nav.architecture")}
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-gray-400 hover:text-white">
                  {t("nav.apiReference")}
                </Link>
              </li>
              <li>
                <Link href="/benchmarks" className="text-gray-400 hover:text-white">
                  {t("nav.benchmarks")}
                </Link>
              </li>
              <li>
                <Link href="/tutorials" className="text-gray-400 hover:text-white">
                  {t("nav.tutorials")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white">
                  {t("nav.faq")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t("footer.community")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="https://github.com/vcms-io/solidis" className="text-gray-400 hover:text-white">
                  {t("nav.github")}
                </Link>
              </li>
              <li>
                <Link href="https://github.com/vcms-io/solidis/issues" className="text-gray-400 hover:text-white">
                  Issues
                </Link>
              </li>
              <li>
                <Link href="https://github.com/vcms-io/solidis/discussions" className="text-gray-400 hover:text-white">
                  Discussions
                </Link>
              </li>
              <li>
                <Link href="/contributing" className="text-gray-400 hover:text-white">
                  {t("nav.contributing")}
                </Link>
              </li>
              <li>
                <Link href="/updates" className="text-gray-400 hover:text-white">
                  {t("nav.updates")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t("footer.connect")}</h3>
            <div className="flex space-x-4">
              <Link href="https://github.com/vcms-io/solidis" className="text-gray-400 hover:text-white">
                <Github className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <Mail className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2024 VCMS.io. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  )
}
