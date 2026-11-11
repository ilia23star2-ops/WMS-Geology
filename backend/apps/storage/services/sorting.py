"""
Помощник по сортировке (серия 2.x-sorting).
Агрегирует рекомендации по уникальным ячейкам.
"""
from typing import List, Dict, Any
from apps.storage.models import Container, Cell


def suggest_placement(container_ids: List[int]) -> List[Dict[str, Any]]:
    containers = list(Container.objects.filter(id__in=container_ids))
    if not containers:
        return []

    groups = {}
    for c in containers:
        key = (c.draft_site_id, c.draft_research_type_id, c.draft_work_order_coded)
        groups.setdefault(key, []).append(c)

    cells = list(
        Cell.objects.select_related("tier__section__rack__room")
        .prefetch_related("pallet__containers")
        .all()
    )

    cell_data = {}

    for (site_id, rt_id, wo), grp_containers in groups.items():
        for cell in cells:
            score = 0
            pallet = getattr(cell, "pallet", None)
            is_empty = not pallet or not pallet.containers.exists()

            has_site, has_rt, has_wo = False, False, False
            
            if not is_empty:
                for c in pallet.containers.all():
                    if site_id and c.draft_site_id == site_id:
                        has_site = True
                        score += 10
                    if rt_id and c.draft_research_type_id == rt_id:
                        has_rt = True
                        score += 5
                    if wo and c.draft_work_order_coded == wo:
                        has_wo = True
                        score += 5

            if is_empty:
                score += 1

            if score > 0:
                if cell.id not in cell_data:
                    cell_data[cell.id] = {
                        "cell_id": cell.id,
                        "full_address": cell.full_address,
                        "score": 0,
                        "has_site": False,
                        "has_rt": False,
                        "has_wo": False,
                        "has_empty": False,
                        "containers": [],
                        "capacity_used": pallet.containers.count() if not is_empty else 0,
                        "capacity_max": 10
                    }
                
                cell_data[cell.id]["score"] += score
                if has_site: cell_data[cell.id]["has_site"] = True
                if has_rt: cell_data[cell.id]["has_rt"] = True
                if has_wo: cell_data[cell.id]["has_wo"] = True
                if is_empty: cell_data[cell.id]["has_empty"] = True
                
                cell_data[cell.id]["containers"].extend([
                    {
                        "id": c.id,
                        "number": c.container_number or f"#{c.id}",
                        "wo": c.draft_work_order_coded or "Без Н/З",
                        "rt": c.draft_research_type.name if c.draft_research_type else "Без ТИ"
                    } for c in grp_containers
                ])

    result = list(cell_data.values())
    
    for r in result:
        parts = []
        if r["has_site"]: parts.append("Участок")
        if r["has_rt"]: parts.append("Тип исследования")
        if r["has_wo"]: parts.append("Наряд/Заказ")
        
        if parts:
            r["reason"] = f"Совпадения: {', '.join(parts)}"
        elif r["has_empty"]:
            r["reason"] = "Ячейка свободна"
        else:
            r["reason"] = ""

        # Очищаем служебные поля
        del r["has_site"]
        del r["has_rt"]
        del r["has_wo"]
        del r["has_empty"]
        
    result.sort(key=lambda x: x["score"], reverse=True)
    return result[:5]