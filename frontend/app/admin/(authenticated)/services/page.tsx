import { db } from "@/lib/db";
import { CreateServiceForm } from "@/components/CreateServiceForm";
import { ServiceListItem } from "@/components/ServiceListItem";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await db.service.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Services</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            These appear on your landing page with the prices you set.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
          {services.length === 0 ? (
            <p className="px-5 py-4 sm:px-6 text-sm text-gray-400 dark:text-slate-500">
              No services yet — add one below.
            </p>
          ) : (
            services.map((service) => (
              <ServiceListItem key={service.id} service={service} />
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add a Service</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
          <CreateServiceForm />
        </div>
      </div>
    </div>
  );
}
