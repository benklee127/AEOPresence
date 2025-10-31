import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatsCard({ title, value, icon: Icon, bgColor }) {
  return (
    <Card className="relative overflow-hidden border-slate-200 bg-white">
      <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 ${bgColor} rounded-full opacity-10`} />
      <CardHeader className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <CardTitle className="text-3xl font-bold mt-2 text-slate-900">
              {value}
            </CardTitle>
          </div>
          <div className={`p-3 rounded-xl ${bgColor} bg-opacity-20`}>
            <Icon className={`w-5 h-5 ${bgColor.replace('bg-', 'text-')}`} />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}