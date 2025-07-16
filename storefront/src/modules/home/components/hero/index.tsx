import { Button, Heading } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-gradient-to-br from-rose-50 to-amber-50">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <Heading
            level="h1"
            className="text-4xl leading-tight text-ui-fg-base font-light"
          >
            Lilianna Jewlery
          </Heading>
          <Heading
            level="h2"
            className="text-2xl leading-8 text-ui-fg-subtle font-light mt-4"
          >
            Exquisite handcrafted jewelry for every occasion
          </Heading>
          <p className="text-lg text-ui-fg-muted mt-4 max-w-2xl">
            Discover our collection of elegant necklaces, stunning earrings, and timeless rings
          </p>
        </span>
        <LocalizedClientLink href="/store">
          <Button variant="primary" className="mt-4">
            Shop Collection
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Hero
