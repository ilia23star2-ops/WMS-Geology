import pytest
from apps.storage.services.sorting import suggest_placement
from apps.storage.models import Container, ContainerType, Cell, Tier, Section, Rack, Room, Pallet
from apps.samples.catalogs import ResearchType, Site

@pytest.mark.django_db
class TestSortingAssistant:
    @pytest.fixture
    def setup_data(self):
        site = Site.objects.create(code="S1", name="Site 1")
        rt = ResearchType.objects.create(code="T1", name="Type 1")
        ctype = ContainerType.objects.create(name="Box")

        # 1. Ячейка с тарой (совпадение по Участку и ТИ)
        room = Room.objects.create(name="Room 1")
        rack = Rack.objects.create(room=room, code="A")
        section = Section.objects.create(rack=rack, code="S1")
        tier = Tier.objects.create(section=section, code="A")
        cell1 = Cell.objects.create(tier=tier, code="1", full_address="Room 1/A/S1/A/1")
        pallet1 = Pallet.objects.create(cell=cell1)
        
        c1 = Container.objects.create(
            container_type=ctype, draft_site=site, draft_research_type=rt
        )
        c1.pallet = pallet1
        c1.save()

        # 2. Пустая ячейка
        cell2 = Cell.objects.create(tier=tier, code="2", full_address="Room 1/A/S1/A/2")

        # 3. Наша тара, которую хотим разместить
        c_target = Container.objects.create(
            container_type=ctype, draft_site=site, draft_research_type=rt
        )

        return c_target, cell1, cell2

    def test_suggest_placement(self, setup_data):
        c_target, cell1, cell2 = setup_data
        result = suggest_placement([c_target.id])
        
        assert len(result) == 2
        # Первая должна быть ячейка с совпадением (score 15)
        assert result[0]["cell_id"] == cell1.id
        assert result[0]["score"] == 15
        assert "Есть тары с того же участка и ТИ" in result[0]["reason"]
        
        # Вторая - пустая (score 1)
        assert result[1]["cell_id"] == cell2.id
        assert result[1]["score"] == 1