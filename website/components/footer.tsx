import Link from "next/link"
import { Github, Twitter, Mail } from "lucide-react"

export function Footer() {
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
              High-performance RESP client for Redis and other RESP-compatible servers.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Documentation</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/getting-started" className="text-gray-400 hover:text-white">
                  Getting Started
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-gray-400 hover:text-white">
                  API Reference
                </Link>
              </li>
              <li>
                <Link href="/tutorials" className="text-gray-400 hover:text-white">
                  Tutorials
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Community</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="https://github.com/vcms-io/solidis" className="text-gray-400 hover:text-white">
                  GitHub
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
                <Link href="/updates" className="text-gray-400 hover:text-white">
                  Updates
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Connect</h3>
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
          <p>&copy; 2024 VCMS.io. All rights reserved. Licensed under MIT.</p>
        </div>
      </div>
    </footer>
  )
}
